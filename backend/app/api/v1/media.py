"""Catalog route handlers."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.schemas.media import MediaCategory, MediaItem, MediaPage, SemanticMediaPage, SemanticMediaResult
from app.services.catalog import get_media, list_media, to_schema
from app.services.semantic_search import EMBEDDING_MODEL, search_semantic


router = APIRouter(prefix="/media", tags=["media"])


@router.get("/semantic", response_model=SemanticMediaPage)
def search_media_semantically(
    session: Annotated[Session, Depends(get_session)],
    q: Annotated[str, Query(min_length=3, max_length=500)],
    category: MediaCategory | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    exclude_ids: Annotated[list[str], Query()] = [],
) -> SemanticMediaPage:
    """Search media by meaning, mood, themes, and cross-category language."""

    query = " ".join(q.split())
    if len(query) < 3:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Search text must contain at least three non-space characters.")
    try:
        matches = search_semantic(session, query, category=category, limit=limit, exclude_ids=set(exclude_ids))
    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Semantic search is not ready; apply the pgvector migration and build the catalog embedding index.",
        ) from error
    return SemanticMediaPage(
        query=query,
        model=EMBEDDING_MODEL,
        items=[SemanticMediaResult(item=to_schema(item), similarity=score) for item, score in matches],
        total=len(matches),
    )


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
