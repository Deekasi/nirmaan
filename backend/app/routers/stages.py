from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai import llm, prompts, research as research_pipeline
from app.ai import schemas as ai
from app.builder import build_zip
from app.database import get_db
from app.deps import get_current_user
from app.models import STAGE_ORDER, Project, Stage, StageResult, User
from app.routers.projects import get_owned_project
from app.schemas import PlanSelection, ProjectOut, StageResultOut

router = APIRouter(prefix="/projects/{project_id}", tags=["stages"])


# ---------- helpers ----------

def get_result(db: Session, project: Project, stage: str) -> StageResult | None:
    return db.scalar(
        select(StageResult).where(StageResult.project_id == project.id, StageResult.stage == stage)
    )


def require_result(db: Session, project: Project, stage: str) -> dict:
    result = get_result(db, project, stage)
    if result is None:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Finish the {stage} stage first.")
    return result.data


def save_result(db: Session, project: Project, stage: str, data: dict) -> StageResult:
    result = get_result(db, project, stage)
    if result:
        result.data = data
    else:
        result = StageResult(project_id=project.id, stage=stage, data=data)
        db.add(result)
    # Move the project forward, but never backwards when a stage is re-run.
    next_index = STAGE_ORDER.index(stage) + 1
    if STAGE_ORDER.index(project.stage.value) < next_index < len(STAGE_ORDER):
        project.stage = Stage(STAGE_ORDER[next_index])
    db.commit()
    db.refresh(result)
    return result


def run_ai(fn, *args):
    try:
        return fn(*args)
    except llm.LLMError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e)) from e


# ---------- routes ----------

@router.get("/results", response_model=list[StageResultOut])
def list_results(project_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = get_owned_project(project_id, user, db)
    return sorted(project.results, key=lambda r: STAGE_ORDER.index(r.stage))


@router.post("/research", response_model=StageResultOut)
def run_research(project_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = get_owned_project(project_id, user, db)
    data = run_ai(research_pipeline.run_research, project.name, project.idea)
    return save_result(db, project, "research", data)


@router.post("/validate", response_model=StageResultOut)
def run_validate(project_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = get_owned_project(project_id, user, db)
    research = require_result(db, project, "research")
    validation = run_ai(
        llm.generate_structured, prompts.validate(project.name, project.idea, research), ai.Validation
    )
    return save_result(db, project, "validate", validation.model_dump())


@router.post("/plan", response_model=StageResultOut)
def run_plan(project_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = get_owned_project(project_id, user, db)
    validation = require_result(db, project, "validate")
    plan = run_ai(llm.generate_structured, prompts.plan(project.name, project.idea, validation), ai.Plan)
    return save_result(db, project, "plan", plan.model_dump())


@router.post("/build", response_model=StageResultOut)
def run_build(
    project_id: int,
    body: PlanSelection,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = get_owned_project(project_id, user, db)
    validation = require_result(db, project, "validate")
    plan = require_result(db, project, "plan")

    known = {f["name"] for f in plan["features"]}
    unknown = [f for f in body.selected_features if f not in known]
    if unknown:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Unknown features: {', '.join(unknown)}")

    config = run_ai(
        llm.generate_structured,
        prompts.build_config(project.name, project.idea, validation, body.selected_features, body.template),
        ai.BaseProjectConfig,
    )
    data = {"template": body.template, "selected_features": body.selected_features, "config": config.model_dump()}
    return save_result(db, project, "build", data)


@router.get("/download")
def download(project_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = get_owned_project(project_id, user, db)
    research = require_result(db, project, "research")
    build = require_result(db, project, "build")
    context = {
        "project": ProjectOut.model_validate(project).model_dump(),
        "research": research,
        "sources": research.get("sources", []),
        "validation": require_result(db, project, "validate"),
        "plan": require_result(db, project, "plan"),
        "selected": build["selected_features"],
        "c": build["config"],
    }
    filename, data = build_zip(build["template"], context)
    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
