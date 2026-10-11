"""TASTERA FastAPI application entry point."""

from fastapi import FastAPI

app = FastAPI(
    title="TASTERA API",
    description="Personalized discovery across movies, books, and music.",
    version="0.1.0",
)


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    """Return a lightweight service health response."""
    return {"status": "ok", "service": "tastera-api"}
