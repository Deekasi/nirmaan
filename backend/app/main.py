from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import auth, projects


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Phase 1 shortcut: create tables on startup.
    # Switch to Alembic migrations once the schema starts changing often.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Nirmaan API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(projects.router)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}
