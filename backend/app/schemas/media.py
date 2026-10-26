"""Schemas for canonical media catalog records."""

from enum import Enum
from datetime import datetime

from pydantic import BaseModel, Field, HttpUrl


class MediaCategory(str, Enum):
    """Supported catalog categories."""

    MOVIES = "Movies"
    BOOKS = "Books"
    MUSIC = "Music"
    TV = "TV"
    GAMES = "Games"
    PODCASTS = "Podcasts"


class MediaItem(BaseModel):
    """A canonical catalog item returned to API consumers."""

    id: str = Field(description="Stable TASTERA catalog identifier.")
    title: str
    creator: str
    category: MediaCategory
    genre: str
    image: HttpUrl | None = None
    language: str | None = None
    watch_url: HttpUrl | None = None
    provider_region: str | None = None
    description: str | None = None
    connection: str = Field(
        description="Editorial explanation for this development catalog item."
    )
    source: str = Field(description="Catalog provenance label.")
    updated_at: datetime | None = Field(default=None, description="When this catalog record was last updated.")
    popularity_score: float = Field(default=0, description="Provider-specific ordering signal; not comparable across media types.")


class MediaPage(BaseModel):
    """A deterministic, paginated catalog response."""

    items: list[MediaItem]
    page: int = Field(ge=1)
    limit: int = Field(ge=1)
    total: int = Field(ge=0)
    total_pages: int = Field(ge=0)


class MediaFilters(BaseModel):
    """Distinct genre and language options for catalog filters."""

    genres: list[str]
    languages: list[str]


class SemanticMediaResult(BaseModel):
    """One semantically retrieved item and its cosine similarity score."""

    item: MediaItem
    similarity: float = Field(ge=-1, le=1)


class SemanticMediaPage(BaseModel):
    """Bounded nearest-neighbor results for a natural-language query."""

    query: str
    model: str
    items: list[SemanticMediaResult]
    total: int = Field(ge=0)
