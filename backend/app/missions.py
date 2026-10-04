"""Missions: real engineering tasks to grow the starter project, built from the user's choices."""
import re

SKILLS = {
    "landing": ["HTML", "CSS"],
    "webapp": ["FastAPI", "SQL", "JavaScript"],
    "chatbot": ["FastAPI", "LLM APIs", "JavaScript"],
}


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:50]


def build_missions(template: str, selected_features: list[str], features: list[dict]) -> list[dict]:
    desc = {f["name"]: f.get("description", "") for f in features}
    is_python = template in ("webapp", "chatbot")
    missions = [
        {"id": "run-locally", "title": "Run it on your laptop", "detail": "Follow the README until the app opens in your browser.",
         "difficulty": "easy", "skills": ["Python venv"] if is_python else ["Browser"]},
        {"id": "push-github", "title": "Push it to GitHub", "detail": "Create a repository and push your first commit.",
         "difficulty": "easy", "skills": ["Git"]},
    ]
    for name in selected_features:
        missions.append({
            "id": "feature-" + _slug(name), "title": f"Build: {name}", "detail": desc.get(name, ""),
            "difficulty": "medium", "skills": SKILLS.get(template, []),
        })
    if is_python:
        missions.append({"id": "first-test", "title": "Write your first automated test",
                         "detail": "Use pytest and FastAPI's TestClient to check one endpoint returns 200.",
                         "difficulty": "medium", "skills": ["pytest", "Testing"]})
        missions.append({"id": "validation", "title": "Handle bad input gracefully",
                         "detail": "Try empty or very long input and make sure users see a clear error.",
                         "difficulty": "medium", "skills": ["Pydantic", "UX"]})
    missions += [
        {"id": "deploy", "title": "Put it online", "detail": "Deploy on Render using the README steps and share the link.",
         "difficulty": "medium", "skills": ["Cloud", "Deployment"]},
        {"id": "explain", "title": "Explain the architecture in 60 seconds",
         "detail": "Use the viva answers in NIRMAAN_REPORT.md and say it out loud once.",
         "difficulty": "easy", "skills": ["Communication"]},
    ]
    return missions
