"""Prompt text for each stage. Kept in one file so they are easy to read and improve."""
import json

from app.ai import schemas as s

ROLE = (
    "You are Nirmaan, a friendly product mentor for students and first-time builders "
    "with little technical knowledge. Use simple, clear English. Be honest, not hype."
)


def research(name: str, idea: str) -> str:
    return f"""{ROLE}

Research the market for this idea by searching the web. Prefer recent sources.
Include the Indian market where relevant.

Project name: {name}
Idea: {idea}

Find real existing competitors (name actual products), real complaints users have
about them, and whether this space is growing."""


def validate(name: str, idea: str, research: dict) -> str:
    return f"""{ROLE}

Validate this idea using the research below. Be honest: say "pivot" or "rethink"
if the idea is weak, crowded with no clear angle, or too big for a student.

Project name: {name}
Idea: {idea}

Research findings:
{json.dumps(research, indent=1)}"""


def plan(name: str, idea: str, validation: dict) -> str:
    return f"""{ROLE}

Create a build plan for a beginner's first version of this project.

Project name: {name}
Idea: {idea}

Validation:
{json.dumps(validation, indent=1)}

Rules:
- 6 to 10 features; at most 4 "must" features so the first version stays small.
- recommended_template must be one of:
  "landing" (a marketing website, no data saved),
  "webapp" (users add and view saved items; Python backend + database),
  "chatbot" (an AI assistant people chat with).
- tech_stack MUST describe the starter template exactly, because that is the code the user receives:
  landing = HTML + CSS (no backend); webapp = FastAPI (Python) + SQLite + HTML/JavaScript;
  chatbot = FastAPI (Python) + Groq API + HTML/JavaScript. Hosting is Render for all three.
  If a feature needs extra tools (e.g. OpenCV, a ML model), mention them in that feature's
  description as something to add later, not in tech_stack.
- viva_questions: exactly 5, the kind a college examiner or interviewer would ask."""


def build_config(name: str, idea: str, validation: dict, features: list[str], template: str) -> str:
    return f"""{ROLE}

Fill in the configuration for a starter "{template}" project.

Project name: {name}
Idea: {idea}
Target user: {validation.get("target_user", "")}
Unique angle: {validation.get("unique_angle", "")}
Features the user selected: {", ".join(features)}

Rules:
- app_name: short and catchy (max 3 words).
- features: one card per selected feature, written for a landing page.
- primary_color: a hex colour that suits the idea, readable with white text.
- entity_name / entity_plural: the main thing users add in the app (e.g. "rating" / "ratings")."""
