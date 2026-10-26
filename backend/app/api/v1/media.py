"""Catalog route handlers."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.models.catalog import CreatorAliasRecord, MediaItemRecord, MediaRelationshipRecord
from app.schemas.media import MediaCategory, MediaFilters, MediaItem, MediaPage, SemanticMediaPage, SemanticMediaResult
from app.services.catalog import get_media, get_media_filters, list_media, to_schema
from app.services.semantic_search import EMBEDDING_MODEL, search_semantic


router = APIRouter(prefix="/media", tags=["media"])


@router.get("/{media_id}/relationships")
def get_media_relationships(media_id: str, session: Annotated[Session, Depends(get_session)]):
    """Return sourced catalog links, distinct from semantic similarity."""
    if session.get(MediaItemRecord, media_id) is None:
        raise HTTPException(status_code=404, detail="Media item not found.")
    rows = session.scalars(select(MediaRelationshipRecord).where(
        (MediaRelationshipRecord.source_media_id == media_id) | (MediaRelationshipRecord.target_media_id == media_id)
    ).order_by(MediaRelationshipRecord.relationship_type)).all()
    result = []
    for relation in rows:
        other_id = relation.target_media_id if relation.source_media_id == media_id else relation.source_media_id
        item = session.get(MediaItemRecord, other_id)
        if item is not None:
            result.append({"type": relation.relationship_type, "provenance": relation.provenance,
                "source_url": relation.source_url, "confidence": relation.confidence,
                "item": to_schema(item)})
    return result


@router.get("/creators/aliases")
def resolve_creator_alias(query: Annotated[str, Query(min_length=1, max_length=200)], session: Annotated[Session, Depends(get_session)]):
    """Resolve a manually attributed alias without overwriting the source credit."""
    alias = session.scalar(select(CreatorAliasRecord).where(func.lower(CreatorAliasRecord.alias) == query.strip().lower()))
    if alias is None:
        return {"query": query, "canonical_name": query, "matched": False, "provenance": None}
    return {"query": query, "canonical_name": alias.canonical_name, "matched": True,
        "provenance": alias.provenance, "source_url": alias.source_url}


@router.get("/semantic", response_model=SemanticMediaPage)
def search_media_semantically(
    session: Annotated[Session, Depends(get_session)],
    q: Annotated[str, Query(min_length=3, max_length=500)],
    category: MediaCategory | None = None,
    language: Annotated[str | None, Query(min_length=2, max_length=40)] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    exclude_ids: Annotated[list[str], Query()] = [],
) -> SemanticMediaPage:
    """Search media by meaning, mood, themes, and cross-category language."""

    query = " ".join(q.split())
    if len(query) < 3:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Search text must contain at least three non-space characters.")
    try:
        matches = search_semantic(session, query, category=category, language=language, limit=limit, exclude_ids=set(exclude_ids))
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
    language: Annotated[str | None, Query(min_length=2, max_length=40)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=150)] = 20,
) -> MediaPage:
    """List catalog media with optional category and text filtering."""

    return list_media(session, category=category, query=q, language=language, page=page, limit=limit)


@router.get("/filters", response_model=MediaFilters)
def get_catalog_filters(
    session: Annotated[Session, Depends(get_session)],
    category: MediaCategory | None = None,
) -> MediaFilters:
    """List genre and language filter values for the full selected category."""
    return get_media_filters(session, category=category)


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
