"""TASTERA FastAPI application entry point."""

from contextlib import asynccontextmanager
import logging
from os import getenv
import os

from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.v1.auth import router as auth_router
from app.api.v1.ai import router as ai_router
from app.api.v1.evaluation import router as evaluation_router
from app.api.v1.media import router as media_router
from app.api.v1.recommendations import router as recommendations_router
from app.api.v1.saved import router as saved_router
from app.api.v1.social import router as social_router
from app.core.rate_limit import limiter

logger = logging.getLogger("tastera")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run pending Alembic database migrations on startup so the DB is always in sync."""
    db_url = getenv("TASTERA_DATABASE_URL", "")
    if db_url:
        try:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            ini_file = os.path.join(base_dir, "alembic.ini")
            if os.path.exists(ini_file):
                alembic_cfg = Config(ini_file)
                alembic_cfg.set_main_option("script_location", os.path.join(base_dir, "alembic"))
                command.upgrade(alembic_cfg, "head")
                logger.info("Database schema is up to date (alembic head).")
        except Exception as exc:
            logger.warning("Database auto-migration skipped or failed: %s", exc)
    yield


app = FastAPI(
    title="TASTERA API",
    description="Personalized discovery across movies, books, and music.",
    version="0.1.0",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

cors_origins = tuple(
    origin.strip()
    for origin in getenv(
        "TASTERA_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174",
    ).split(",")
    if origin.strip()
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(media_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")
app.include_router(evaluation_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(saved_router, prefix="/api/v1")
app.include_router(recommendations_router, prefix="/api/v1")
app.include_router(social_router, prefix="/api/v1")


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    """Return a lightweight service health response."""
    return {"status": "ok", "service": "tastera-api"}
