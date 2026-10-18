"""Response models for personalized recommendations."""

from pydantic import BaseModel, Field

from app.schemas.media import MediaItem


class Recommendation(BaseModel):
    item: MediaItem
    reason: str
    matched_genres: list[str]


class RecommendationPage(BaseModel):
    items: list[Recommendation]
    saved_count: int = Field(ge=0)
    message: str
