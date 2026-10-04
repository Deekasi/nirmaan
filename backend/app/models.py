import enum
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Stage(str, enum.Enum):
    """The five Nirmaan stages, in order. A project's stage = the next step to do."""

    research = "research"
    validate = "validate"
    plan = "plan"
    build = "build"
    download = "download"


STAGE_ORDER = [s.value for s in Stage]


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    hashed_password: Mapped[str] = mapped_column(String(255))
    # Login tokens issued before this moment stop working (set when the password is reset).
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    projects: Mapped[list["Project"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    idea: Mapped[str] = mapped_column(Text)
    stage: Mapped[Stage] = mapped_column(Enum(Stage), default=Stage.research)
    # "active" while being worked on, "finished" once the user marks it done.
    status: Mapped[str | None] = mapped_column(String(20), default="active")
    github_url: Mapped[str | None] = mapped_column(String(300), nullable=True)
    live_url: Mapped[str | None] = mapped_column(String(300), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    owner: Mapped[User] = relationship(back_populates="projects")
    results: Mapped[list["StageResult"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class StageResult(Base):
    """The AI output for one stage of one project, stored as JSON."""

    __tablename__ = "stage_results"
    __table_args__ = (UniqueConstraint("project_id", "stage"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    stage: Mapped[str] = mapped_column(String(20))
    data: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    project: Mapped[Project] = relationship(back_populates="results")


class TrendReport(Base):
    """Cached results for the Explore page, so we don't spend search credits on every visit."""

    __tablename__ = "trend_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    topic: Mapped[str] = mapped_column(String(40), index=True)
    data: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PasswordReset(Base):
    """A one-time password reset link. Only a SHA-256 hash of the token is stored."""

    __tablename__ = "password_resets"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
