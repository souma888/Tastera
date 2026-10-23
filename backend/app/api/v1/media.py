"""Catalog route handlers."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.schemas.media import MediaCategory, MediaItem, MediaPage
from app.services.catalog import get_media, list_media


router = APIRouter(prefix="/media", tags=["media"])


@router.get("", response_model=MediaPage)
def get_media_catalog(
    session: Annotated[Session, Depends(get_session)],
    category: MediaCategory | None = None,
    q: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=150)] = 20,
) -> MediaPage:
    """List catalog media with optional category and text filtering."""

    return list_media(session, category=category, query=q, page=page, limit=limit)


@router.get("/{media_id}", response_model=MediaItem)
def get_media_detail(
    media_id: str, session: Annotated[Session, Depends(get_session)]
) -> MediaItem:
    """Return one catalog item or a standard not-found response."""

    item = get_media(session, media_id)
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media item not found.",
        )
    return item
