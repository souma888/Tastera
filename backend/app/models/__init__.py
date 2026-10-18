"""Database models for TASTERA."""

from app.models.catalog import Genre, MediaGenre, MediaIdentifier, MediaItemRecord
from app.models.account import (
    AccountRecord,
    RecommendationFeedbackRecord,
    SavedMediaRecord,
)

__all__ = [
    "AccountRecord",
    "Genre",
    "MediaGenre",
    "MediaIdentifier",
    "MediaItemRecord",
    "RecommendationFeedbackRecord",
    "SavedMediaRecord",
]
