"""Pydantic models describing exactly what the AI must return for each stage.

Using schemas (instead of free text) means every AI answer is validated before
it is saved, so the frontend can always rely on the same shape.
"""
from typing import Literal

from pydantic import BaseModel, Field


class Competitor(BaseModel):
    name: str
    what_they_do: str
    weakness: str


class SearchPlan(BaseModel):
    queries: list[str] = Field(description="4 short, specific web search queries", min_length=2, max_length=5)


class Research(BaseModel):
    summary: str = Field(description="3-4 sentence plain-language overview of the market, with [n] citations")
    market_trend: str = Field(description="Is this space growing, stable or shrinking, and why, with [n] citations")
    competitors: list[Competitor] = Field(description="3-6 real existing products found in the sources")
    user_complaints: list[str] = Field(description="Real pain points users mention, each with [n] citations")
    opportunities: list[str] = Field(description="Gaps this idea could fill, based on the findings")


class Validation(BaseModel):
    target_user: str
    problem_statement: str
    unique_angle: str = Field(description="What makes this idea different from the competitors")
    risks: list[str]
    feasibility_score: int = Field(ge=1, le=10, description="How buildable this is for a student in weeks")
    verdict: Literal["go", "pivot", "rethink"]
    verdict_reason: str


class Feature(BaseModel):
    name: str
    description: str
    priority: Literal["must", "nice", "later"]


class StackChoice(BaseModel):
    layer: str
    choice: str
    why: str


class VivaQuestion(BaseModel):
    question: str
    answer: str


class Plan(BaseModel):
    features: list[Feature] = Field(description="6-10 features across must, nice and later")
    recommended_template: Literal["landing", "webapp", "chatbot"]
    template_reason: str
    tech_stack: list[StackChoice]
    beginner_explanation: str = Field(description="How the app works, explained to a total beginner")
    viva_questions: list[VivaQuestion] = Field(description="5 questions an examiner or interviewer may ask, with answers")


class FeatureCard(BaseModel):
    title: str
    description: str


class BaseProjectConfig(BaseModel):
    app_name: str = Field(max_length=40)
    tagline: str = Field(max_length=90)
    description: str = Field(max_length=400)
    audience: str = Field(max_length=120)
    primary_color: str = Field(description="A hex colour like #2B6CB0 that suits the idea")
    features: list[FeatureCard] = Field(description="The selected features, written for a landing page")
    entity_name: str = Field(description="Singular noun for the main thing users add, e.g. 'review'")
    entity_plural: str = Field(description="Plural of entity_name, e.g. 'reviews'")
    chatbot_persona: str = Field(description="System prompt for a helpful assistant for this idea")
