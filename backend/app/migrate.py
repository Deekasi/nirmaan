"""Tiny schema migration: add new columns to existing tables.

`Base.metadata.create_all` creates missing tables but never changes existing ones, so a
database created by an older version would be missing the new project columns. This adds
them safely on startup (works on SQLite and PostgreSQL). A larger project would use Alembic.
"""
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

NEW_PROJECT_COLUMNS = {
    "status": "VARCHAR(20) DEFAULT 'active'",
    "github_url": "VARCHAR(300)",
    "live_url": "VARCHAR(300)",
    "notes": "TEXT",
    "finished_at": "TIMESTAMP",
}


def add_missing_columns(engine: Engine) -> list[str]:
    inspector = inspect(engine)
    if "projects" not in inspector.get_table_names():
        return []
    existing = {c["name"] for c in inspector.get_columns("projects")}
    added = []
    with engine.begin() as conn:
        for name, ddl in NEW_PROJECT_COLUMNS.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE projects ADD COLUMN {name} {ddl}"))
                added.append(name)
    return added
