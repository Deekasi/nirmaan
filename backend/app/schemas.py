import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import Stage


class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    name: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


IDEA_HELP = "Describe your idea in at least a few real words, for example who it's for and what problem it solves."


def check_idea_text(idea: str) -> str:
    """Cheap first filter for keyboard-mashing. Works for any language's letters, not only English."""
    words = re.findall(r"[^\W\d_]{2,}", idea)
    if len(words) < 4 or max(len(w) for w in words) > 30:
        raise ValueError(IDEA_HELP)
    return idea


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    idea: str = Field(min_length=10, max_length=5000)

    @field_validator("idea")
    @classmethod
    def idea_must_be_words(cls, v: str) -> str:
        return check_idea_text(v)


URL_PATTERN = r"^(https?://\S{3,290})?$"  # empty string clears the link


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    idea: str | None = Field(default=None, min_length=10, max_length=5000)
    status: Literal["active", "finished"] | None = None
    github_url: str | None = Field(default=None, pattern=URL_PATTERN)
    live_url: str | None = Field(default=None, pattern=URL_PATTERN)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("idea")
    @classmethod
    def idea_must_be_words(cls, v: str | None) -> str | None:
        return check_idea_text(v) if v is not None else v


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    idea: str
    stage: Stage
    status: str = "active"
    github_url: str | None = None
    live_url: str | None = None
    notes: str | None = None
    finished_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    @field_validator("status", mode="before")
    @classmethod
    def default_status(cls, v):
        return v or "active"


class ProjectSummary(ProjectOut):
    """A project plus a few highlights for the library cards."""

    verdict: str | None = None
    feasibility: int | None = None
    template: str | None = None


class StageResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    stage: str
    data: dict
    created_at: datetime


class PlanSelection(BaseModel):
    selected_features: list[str] = Field(min_length=1, max_length=20)
    template: Literal["landing", "webapp", "chatbot"]


class MissionsUpdate(BaseModel):
    done: list[str] = Field(max_length=50)
