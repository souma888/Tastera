"""Database models for TASTERA."""

from app.models.catalog import Genre, MediaEmbeddingRecord, MediaGenre, MediaIdentifier, MediaItemRecord
from app.models.account import (
    AccountRecord,
    LibraryActivityRecord,
    RecommendationFeedbackRecord,
    SavedMediaRecord,
)

__all__ = [
    "AccountRecord",
    "Genre",
    "LibraryActivityRecord",
    "MediaGenre",
    "MediaEmbeddingRecord",
    "MediaIdentifier",
    "MediaItemRecord",
    "RecommendationFeedbackRecord",
    "SavedMediaRecord",
]
