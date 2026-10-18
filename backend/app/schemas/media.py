"""Schemas for canonical media catalog records."""

from enum import Enum

from pydantic import BaseModel, Field, HttpUrl


class MediaCategory(str, Enum):
    """Supported catalog categories."""

    MOVIES = "Movies"
    BOOKS = "Books"
    MUSIC = "Music"


class MediaItem(BaseModel):
    """A canonical catalog item returned to API consumers."""

    id: str = Field(description="Stable TASTERA catalog identifier.")
    title: str
    creator: str
    category: MediaCategory
    genre: str
    image: HttpUrl
    description: str | None = None
    connection: str = Field(
        description="Editorial explanation for this development catalog item."
    )
    source: str = Field(description="Catalog provenance label.")


class MediaPage(BaseModel):
    """A deterministic, paginated catalog response."""

    items: list[MediaItem]
    page: int = Field(ge=1)
    limit: int = Field(ge=1)
    total: int = Field(ge=0)
    total_pages: int = Field(ge=0)
