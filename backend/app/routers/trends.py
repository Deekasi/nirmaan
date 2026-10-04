from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai import llm
from app.ai.trends import TOPICS, run_trends
from app.database import get_db
from app.deps import get_current_user
from app.models import TrendReport, User

router = APIRouter(prefix="/trends", tags=["trends"])
CACHE_HOURS = 24


@router.get("")
def get_trends(
    topic: str = Query(default="all"),
    refresh: bool = False,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if topic not in TOPICS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Topic must be one of: {', '.join(TOPICS)}")

    cached = db.scalar(
        select(TrendReport).where(TrendReport.topic == topic).order_by(TrendReport.created_at.desc())
    )
    if cached and not refresh:
        created = cached.created_at if cached.created_at.tzinfo else cached.created_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) - created < timedelta(hours=CACHE_HOURS):
            return {**cached.data, "topic": topic, "updated_at": created.isoformat(), "cached": True}

    try:
        data = run_trends(topic)
    except llm.LLMError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e)) from e

    report = TrendReport(topic=topic, data=data)
    db.add(report)
    db.commit()
    db.refresh(report)
    created = report.created_at if report.created_at.tzinfo else report.created_at.replace(tzinfo=timezone.utc)
    return {**data, "topic": topic, "updated_at": created.isoformat(), "cached": False}
