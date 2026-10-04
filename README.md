# Nirmaan

A research-first project builder for beginners. Nirmaan researches your idea's market with live web
sources, validates it honestly, plans version 1 with you, and gives you a working starter project to download.

**Stages:** Research → Validate → Plan → Base project → Download

- **Research:** the AI writes 6 focused search queries (competitors, complaints, market size, pricing, India,
  recent news), searches the web (Tavily), and writes a report only from those pages, with numbered [n]
  citations: key numbers, market size, competitor pricing, target users, India angle and a SWOT.
- **Validate:** target user, problem, unique angle, risks, feasibility score and a go / pivot / rethink verdict.
- **Plan:** features sorted into Must / Nice / Later (you pick), tech stack with reasons, and viva questions.
- **Base project:** one of three tested templates (landing site, web app, AI chatbot), customized by AI.
- **Build report:** the generated project goes through an 8-step quality gate (syntax, HTML, secret scan,
  pinned dependencies, Git hygiene, docs, package size) shown like a CI run, plus an architecture diagram,
  file tree with line counts, and a Missions board of real engineering tasks to grow the project.
- **Download:** a zip with working code, a beginner README, and NIRMAAN_REPORT.md (research + plan + viva prep).

Also: a **project library** (In progress / Finished, search, GitHub and live links), an **Explore** page with
trending areas and buildable ideas from live sources (cached for a day), and a printable **report** you can save
as PDF.

## Stack

| Layer    | Tech                                   |
| -------- | -------------------------------------- |
| Frontend | React 18 + TypeScript (Vite)           |
| Backend  | Python 3.12 + FastAPI + SQLAlchemy 2   |
| Database | SQLite (local dev) / PostgreSQL (Docker) |
| Auth     | JWT bearer tokens, bcrypt passwords    |
| AI       | Groq free tier (gpt-oss-120b; groq/compound as search fallback); Gemini optional |
| Search   | Tavily (free tier, 1,000 credits/month) |
| Templates| Jinja2, rendered into a zip in memory  |

## Run it (option A: no Docker, lightest on a low-spec laptop)

Backend:

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Create `backend/.env` (copy `.env.example`) and paste your free Groq key from https://console.groq.com
(no credit card), and a free Tavily key from https://tavily.com for real web research (`TAVILY_API_KEY`).
Without keys, Nirmaan runs with demo data, which is handy for testing offline.
To use Gemini instead, set `LLM_PROVIDER=gemini` and `GEMINI_API_KEY`.

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

35 tests covering auth, project CRUD, stage order, re-runs, all three templates producing valid zips,
unknown-feature rejection, users not accessing each other's projects, and the Groq client (simulated replies:
fenced JSON, invalid-JSON retry, source extraction, search-model fallback, rate limits), and the research
pipeline (query planning, de-duplicated numbered sources, honest fallback when search fails), the library
(finish, filters, URL validation), the migration, the quality gate (catches syntax errors and leaked keys),
missions, trends caching and rate-limit retries. Tests always use fake AI
(`LLM_MODE=fake`), so they run offline in seconds and cost nothing.

## Project layout

```
backend/
  app/
    main.py          FastAPI app, CORS, routers
    config.py        settings from env vars
    database.py      engine + session
    models.py        User, Project, StageResult, Stage enum
    schemas.py       request/response models (Pydantic)
    ai/llm.py        AI wrapper: Groq (default) or Gemini, JSON validation + retry, web search, fake mode
    ai/research.py   research pipeline: plan queries, search, cite, record the method used
    ai/search.py     Tavily web search client
    ai/schemas.py    what the AI must return for each stage
    ai/prompts.py    prompt text per stage
    ai/fake.py       demo data for tests and offline use
    builder.py       renders a template + config into a zip
    verify.py        quality gate run on every generated project
    missions.py      engineering missions built from the user's choices
    migrate.py       adds new columns to existing databases on startup
    ai/trends.py     Explore page: trends + ideas from live sources
    starter_templates/  landing, webapp, chatbot (+ common README/report)
    security.py      password hashing + JWT
    deps.py          get_current_user dependency
    routers/auth.py      /auth/register, /auth/login, /auth/me
    routers/projects.py  /projects CRUD
    routers/stages.py    research, validate, plan, build, missions, download
    routers/trends.py    /trends with 24-hour caching
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
| GET    | /projects/{id}/results  | All stage outputs   |
| POST   | /projects/{id}/research | Run market research |
| POST   | /projects/{id}/validate | Validate the idea   |
| POST   | /projects/{id}/plan     | Create the plan     |
| POST   | /projects/{id}/build    | Build base project from chosen features + template |
| PUT    | /projects/{id}/missions | Save mission progress |
| GET    | /projects/{id}/download | Download the zip    |
| GET    | /trends?topic=ai        | Trends and project ideas (cached 24h) |

## Design decisions (keep this log growing)

- **SQLite locally, Postgres in Docker.** Zero setup on a low-spec laptop; same SQLAlchemy code for both.
- **Tables created on startup.** Fine for Phase 1. Switch to Alembic migrations before Phase 2 adds tables.
- **404 for other users' projects, not 403.** Doesn't reveal that a project ID exists.
- **Token in localStorage.** Simple for an MVP. Move to httpOnly cookies before real users.
- **Templates, not free-form AI code.** Beginners can't fix broken code, so the AI only fills a validated
  config (names, colours, features); the code itself comes from tested templates.
- **Structured output.** Every AI answer is validated against a Pydantic schema before it's saved.
- **Free, swappable AI provider.** Groq is the default (free, no card); Gemini is one setting away. The rest
  of the app only calls `generate_structured()` and `research_with_search()`.
- **Grounded research with citations.** The AI plans 4 search queries (fixing typos in the idea), Tavily
  returns real pages, and the AI writes using only those numbered sources, citing [n] after each claim.
  Citations that don't match a real source are dropped in the UI.
- **Honest about method.** Each research result records how it was made (live web research, AI web search,
  or AI knowledge only) and the UI shows it, instead of silently falling back.
- **Self-correcting JSON.** If the AI's JSON fails validation, it is shown the error and asked to fix it once.
- **Fake AI mode.** Tests and offline demos never call the API.
- **Stages run in order** (409 if a previous stage is missing); re-running a stage never moves a project backwards.
- **Escaping.** AI text is HTML-escaped in pages and JSON-encoded in code files, so odd output can't break them.
- **Quality gate on generated code.** Every build is parsed (Python `ast`), HTML-checked, scanned for leaked keys
  and checked for pinned dependencies before the user downloads it.
- **Token budget.** Research sends at most 10 sources of ~1,000 characters each, to stay inside Groq's free
  per-minute limits; short 429s are retried once after the `retry-after` delay.
- **Safe schema changes.** New columns are added on startup by a small migration helper, so existing databases
  (SQLite locally, PostgreSQL on Render) keep working. A bigger project would use Alembic.

## Roadmap

- [x] Phase 1 — Foundation
- [x] Phase 2 — Research, Validate, Plan with a free AI provider (Groq)
- [x] Phase 3 — Base project templates + zip download
- [x] Phase 4 — Project library, deeper research, multi-page workspace, PDF report, Explore, build quality gate, missions
- [ ] Next — One-click push to GitHub, Hindi/Hinglish explanations
