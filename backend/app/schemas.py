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


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    name: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    idea: str = Field(min_length=10, max_length=5000)


URL_PATTERN = r"^(https?://\S{3,290})?$"  # empty string clears the link


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    idea: str | None = Field(default=None, min_length=10, max_length=5000)
    status: Literal["active", "finished"] | None = None
    github_url: str | None = Field(default=None, pattern=URL_PATTERN)
    live_url: str | None = Field(default=None, pattern=URL_PATTERN)
    notes: str | None = Field(default=None, max_length=2000)


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
