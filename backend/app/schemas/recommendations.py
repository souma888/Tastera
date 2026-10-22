"""Response models for personalized recommendations."""

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.media import MediaItem


class Recommendation(BaseModel):
    item: MediaItem
    reason: str
    matched_genres: list[str]
    feedback: Literal["more", "less"] | None = None


class RecommendationFeedbackInput(BaseModel):
    feedback: Literal["more", "less"]


class RecommendationFeedbackResult(BaseModel):
    media_id: str
    feedback: Literal["more", "less"]


class RecommendationFeedbackItem(BaseModel):
    item: MediaItem
    feedback: Literal["more", "less"]


class RecommendationPage(BaseModel):
    items: list[Recommendation]
    feedback_items: list[RecommendationFeedbackItem] = Field(default_factory=list)
    saved_count: int = Field(ge=0)
    method: Literal["genre", "item_item"] = "genre"
    total: int = Field(default=0, ge=0)
    next_offset: int | None = Field(default=None, ge=0)
    message: str
