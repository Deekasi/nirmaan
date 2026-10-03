# Nirmaan

AI product mentor that turns a rough idea into a validated problem, PRD, stack, architecture and a starter repo.

**Status:** Phase 1 (Foundation) — accounts, login, and a project dashboard that tracks each project through six steps:
Idea → Problem → PRD → Stack → Architecture → Repo.

## Stack

| Layer    | Tech                                   |
| -------- | -------------------------------------- |
| Frontend | React 18 + TypeScript (Vite)           |
| Backend  | Python 3.12 + FastAPI + SQLAlchemy 2   |
| Database | SQLite (local dev) / PostgreSQL (Docker) |
| Auth     | JWT bearer tokens, bcrypt passwords    |

## Run it (option A: no Docker, lightest on a low-spec laptop)

Backend:

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API runs at http://localhost:8000 and interactive docs at http://localhost:8000/docs.
Data is stored in `backend/nirmaan.db` (SQLite), no setup needed.

Frontend (new terminal):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173, create an account, and add a project.

## Run it (option B: Docker, with Postgres)

```bash
docker compose up --build
```

Same URLs as above. Postgres data persists in the `pgdata` volume.

## Tests

```bash
cd backend
pytest
```

Covers registration, login, duplicate emails, auth protection, project CRUD, and that users cannot see each other's projects.

## Project layout

```
backend/
  app/
    main.py          FastAPI app, CORS, routers
    config.py        settings from env vars
    database.py      engine + session
    models.py        User, Project, Stage enum
    schemas.py       request/response models (Pydantic)
    security.py      password hashing + JWT
    deps.py          get_current_user dependency
    routers/auth.py      /auth/register, /auth/login, /auth/me
    routers/projects.py  /projects CRUD
  tests/
frontend/
  src/
    api.ts           typed API client
    auth.tsx         auth context
    StageRail.tsx    six-step progress rail
    pages/           AuthPage, Dashboard, ProjectPage
```

## API

| Method | Path              | What it does              |
| ------ | ----------------- | ------------------------- |
| POST   | /auth/register    | Create account, get token |
| POST   | /auth/login       | Get token                 |
| GET    | /auth/me          | Current user              |
| GET    | /projects         | List my projects          |
| POST   | /projects         | Create project            |
| GET    | /projects/{id}    | Get one project           |
| PATCH  | /projects/{id}    | Update name, idea, stage  |
| DELETE | /projects/{id}    | Delete project            |

## Design decisions (keep this log growing)

- **SQLite locally, Postgres in Docker.** Zero setup on a low-spec laptop; same SQLAlchemy code for both.
- **Tables created on startup.** Fine for Phase 1. Switch to Alembic migrations before Phase 2 adds tables.
- **404 for other users' projects, not 403.** Doesn't reveal that a project ID exists.
- **Token in localStorage.** Simple for an MVP. Move to httpOnly cookies before real users.

## Roadmap

- [x] Phase 1 — Foundation
- [ ] Phase 2 — AI planner: idea → clarifying questions → problem → PRD → stack → architecture
- [ ] Phase 3 — Starter code generation
- [ ] Phase 4 — GitHub integration
