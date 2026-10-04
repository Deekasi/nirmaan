from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Project, User
from app.schemas import ProjectCreate, ProjectOut, ProjectSummary, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


def get_owned_project(project_id: int, user: User, db: Session) -> Project:
    project = db.get(Project, project_id)
    # Return 404 (not 403) for other users' projects so we don't leak that they exist.
    if project is None or project.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found.")
    return project


def summarize(project: Project) -> ProjectSummary:
    out = ProjectSummary.model_validate(project)
    results = {r.stage: r.data for r in project.results}
    if "validate" in results:
        out.verdict = results["validate"].get("verdict")
        out.feasibility = results["validate"].get("feasibility_score")
    if "build" in results:
        out.template = results["build"].get("template")
    return out


@router.get("", response_model=list[ProjectSummary])
def list_projects(
    status_filter: str | None = Query(default=None, alias="status", pattern="^(active|finished)$"),
    q: str | None = Query(default=None, max_length=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = select(Project).where(Project.owner_id == user.id)
    if status_filter == "finished":
        stmt = stmt.where(Project.status == "finished")
    elif status_filter == "active":
        stmt = stmt.where(or_(Project.status.is_(None), Project.status != "finished"))
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Project.name.ilike(like), Project.idea.ilike(like)))
    projects = db.scalars(stmt.order_by(Project.updated_at.desc())).all()
    return [summarize(p) for p in projects]


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(body: ProjectCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = Project(owner_id=user.id, name=body.name.strip(), idea=body.idea.strip(), status="active")
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_owned_project(project_id, user, db)


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    body: ProjectUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = get_owned_project(project_id, user, db)
    changes = body.model_dump(exclude_unset=True)
    for field in ("github_url", "live_url", "notes"):
        if field in changes:
            changes[field] = (changes[field] or "").strip() or None
    if "status" in changes:
        if changes["status"] == "finished" and project.status != "finished":
            project.finished_at = datetime.now(timezone.utc)
        elif changes["status"] == "active":
            project.finished_at = None
    for field, value in changes.items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = get_owned_project(project_id, user, db)
    db.delete(project)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
