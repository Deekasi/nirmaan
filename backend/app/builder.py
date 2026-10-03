"""Turns a template folder + the AI-filled config into a downloadable .zip project.

Templates are tested files with a few placeholders, so the generated project always
runs. The AI only chooses the words, colours and features, never the code itself.
"""
import io
import re
import zipfile
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined

TEMPLATES_DIR = Path(__file__).parent / "starter_templates"
TEMPLATES = ("landing", "webapp", "chatbot")

env = Environment(
    loader=FileSystemLoader(TEMPLATES_DIR),
    # Escape user/AI text inside HTML pages to prevent broken markup or script injection.
    autoescape=lambda name: bool(name) and name.endswith(".html.j2"),
    undefined=StrictUndefined,
    keep_trailing_newline=True,
)


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:40] or "my-project"


def clean_config(config: dict) -> dict:
    """Guard against odd AI output before it goes into code files."""
    c = dict(config)
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", str(c.get("primary_color", ""))):
        c["primary_color"] = "#2B6CB0"
    c["entity_name"] = (str(c.get("entity_name") or "item").strip() or "item")[:30]
    c["entity_plural"] = (str(c.get("entity_plural") or c["entity_name"] + "s").strip())[:30]
    return c


def build_zip(template: str, context: dict) -> tuple[str, bytes]:
    if template not in TEMPLATES:
        raise ValueError(f"Unknown template: {template}")

    context = {**context, "c": clean_config(context["c"]), "template": template}
    folder = slugify(context["c"]["app_name"])
    buf = io.BytesIO()

    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for base in ("common", template):
            for path in sorted((TEMPLATES_DIR / base).rglob("*.j2")):
                rel = path.relative_to(TEMPLATES_DIR / base).as_posix()
                rendered = env.get_template(f"{base}/{rel}").render(**context)
                zf.writestr(f"{folder}/{rel[:-3]}", rendered)  # strip ".j2"

    return f"{folder}.zip", buf.getvalue()
