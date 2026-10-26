"""TASTERA FastAPI application entry point."""

from os import getenv

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.auth import router as auth_router
from app.api.v1.ai import router as ai_router
from app.api.v1.evaluation import router as evaluation_router
from app.api.v1.media import router as media_router
from app.api.v1.recommendations import router as recommendations_router
from app.api.v1.saved import router as saved_router
from app.api.v1.social import router as social_router

app = FastAPI(
    title="TASTERA API",
    description="Personalized discovery across movies, books, and music.",
    version="0.1.0",
)

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
