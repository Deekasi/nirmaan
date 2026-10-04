"""Tiny schema migration: add new columns to existing tables.

`Base.metadata.create_all` creates missing tables but never changes existing ones, so a
database created by an older version would be missing the new project columns. This adds
them safely on startup (works on SQLite and PostgreSQL). A larger project would use Alembic.
"""
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

NEW_COLUMNS = {
    "projects": {
        "status": "VARCHAR(20) DEFAULT 'active'",
        "github_url": "VARCHAR(300)",
        "live_url": "VARCHAR(300)",
        "notes": "TEXT",
        "finished_at": "TIMESTAMP",
    },
    "users": {
        "password_changed_at": "TIMESTAMP",
    },
}


def add_missing_columns(engine: Engine) -> list[str]:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    added = []
    with engine.begin() as conn:
        for table, columns in NEW_COLUMNS.items():
            if table not in tables:
                continue
            existing = {c["name"] for c in inspector.get_columns(table)}
            for name, ddl in columns.items():
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
                    added.append(name)
    return added
