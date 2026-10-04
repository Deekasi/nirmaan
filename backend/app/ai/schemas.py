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
    pricing: str = Field(default="Not found in sources", description="Price or business model, with [n] citation if known")


class SearchPlan(BaseModel):
    idea_is_clear: bool = Field(default=True, description="False if the idea is random letters, too vague to research, or not a product idea")
    interpretation: str = Field(default="", description="One sentence: what you understood the idea to be, or what is missing if unclear")
    queries: list[str] = Field(default_factory=list, description="6 short, specific web search queries (empty if the idea is unclear)", max_length=7)


class KeyNumber(BaseModel):
    label: str = Field(description="What the number measures, e.g. 'India edtech market size'")
    value: str = Field(description="The number with unit and year, e.g. 'US$ 7.5B (2025)'")
    source: int | None = Field(default=None, description="Source number this came from")


class Swot(BaseModel):
    strengths: list[str]
    weaknesses: list[str]
    opportunities: list[str]
    threats: list[str]


class Research(BaseModel):
    summary: str = Field(description="3-4 sentence plain-language overview of the market, with [n] citations")
    market_trend: str = Field(description="Is this space growing, stable or shrinking, and why, with [n] citations")
    market_size: str = Field(default="Not found in sources", description="Market size or demand signals, with [n] citations")
    key_numbers: list[KeyNumber] = Field(default_factory=list, description="Up to 6 concrete numbers found in the sources")
    target_segments: list[str] = Field(default_factory=list, description="2-4 specific groups of people who would use this")
    competitors: list[Competitor] = Field(description="3-6 real existing products found in the sources")
    user_complaints: list[str] = Field(description="Real pain points users mention, each with [n] citations")
    opportunities: list[str] = Field(description="Gaps this idea could fill, based on the findings")
    india_angle: str = Field(default="", description="What is specific about the Indian market, with [n] citations")
    swot: Swot | None = Field(default=None, description="SWOT for the user's idea against this market")


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


class Trend(BaseModel):
    title: str = Field(description="Short name of the trend")
    why_now: str = Field(description="2 sentences on why this is growing now, with [n] citations")
    example_ideas: list[str] = Field(description="3 concrete project ideas a student could build", min_length=1, max_length=4)
    difficulty: Literal["beginner", "intermediate", "advanced"]
    sources: list[int] = Field(default_factory=list, description="Source numbers this trend is based on")


class TrendList(BaseModel):
    headline: str = Field(description="One sentence summary of what's moving in this area")
    trends: list[Trend] = Field(description="5 or 6 trends", min_length=1, max_length=8)
