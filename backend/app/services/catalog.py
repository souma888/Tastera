"""Database-backed catalog query service."""

from math import ceil

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.models.catalog import CreatorAliasRecord, MediaItemRecord
from app.schemas.media import MediaCategory, MediaFilters, MediaItem, MediaPage


def to_schema(record: MediaItemRecord) -> MediaItem:
    """Translate a persistent record into the public API contract."""

    return MediaItem(
        id=record.id,
        title=record.title,
        creator=record.creator,
        category=MediaCategory(record.category),
        genre=record.primary_genre,
        image=record.artwork_url,
        language=record.language,
        watch_url=record.watch_url,
        provider_region=record.provider_region,
        description=record.description,
        connection=record.connection,
        source=record.source,
        updated_at=record.updated_at,
        popularity_score=record.popularity_score,
    )


def list_media(
    session: Session,
    *,
    category: MediaCategory | None,
    query: str | None,
    language: str | None,
    page: int,
    limit: int,
) -> MediaPage:
    """Return a deterministic filtered page from the catalog database."""

    statement: Select[tuple[MediaItemRecord]] = select(MediaItemRecord)
    # Don't spend catalog slots on music records that have no album artwork.
    statement = statement.where(
        or_(
            MediaItemRecord.category != MediaCategory.MUSIC.value,
            MediaItemRecord.artwork_url.is_not(None),
        )
    )
    if category:
        statement = statement.where(MediaItemRecord.category == category.value)
    if language:
        statement = statement.where(func.lower(MediaItemRecord.language) == language.strip().lower())

    if query:
        pattern = f"%{query.strip()}%"
        statement = statement.where(
            or_(
                MediaItemRecord.title.ilike(pattern),
                MediaItemRecord.creator.ilike(pattern),
                MediaItemRecord.creator.in_(select(CreatorAliasRecord.canonical_name).where(
                    func.lower(CreatorAliasRecord.alias).ilike(pattern.lower())
                )),
                MediaItemRecord.primary_genre.ilike(pattern),
            )
        )

    total = session.scalar(select(func.count()).select_from(statement.subquery())) or 0
    start = (page - 1) * limit
    records = session.scalars(
        statement.order_by(
            MediaItemRecord.popularity_score.desc(),
            MediaItemRecord.created_at.asc(),
            MediaItemRecord.title,
            MediaItemRecord.id,
        )
        .offset(start)
        .limit(limit)
    ).all()

    return MediaPage(
        items=[to_schema(record) for record in records],
        page=page,
        limit=limit,
        total=total,
        total_pages=ceil(total / limit) if total else 0,
    )


def get_media_filters(session: Session, *, category: MediaCategory | None) -> MediaFilters:
    """Return distinct filter facets available in the complete catalog."""
    statement = select(MediaItemRecord).where(
        or_(
            MediaItemRecord.category != MediaCategory.MUSIC.value,
            MediaItemRecord.artwork_url.is_not(None),
        )
    )
    if category:
        statement = statement.where(MediaItemRecord.category == category.value)
    item_ids = statement.with_only_columns(MediaItemRecord.id).subquery()
    genres = session.scalars(
        select(MediaItemRecord.primary_genre).where(
            MediaItemRecord.primary_genre.is_not(None),
            MediaItemRecord.primary_genre != "",
            MediaItemRecord.id.in_(select(item_ids.c.id)),
        ).distinct().order_by(MediaItemRecord.primary_genre)
    ).all()
    languages = session.scalars(
        select(MediaItemRecord.language).where(
            MediaItemRecord.language.is_not(None),
            MediaItemRecord.language != "",
            MediaItemRecord.id.in_(select(item_ids.c.id)),
        ).distinct().order_by(MediaItemRecord.language)
    ).all()
    return MediaFilters(genres=[value for value in genres if value], languages=[value for value in languages if value])


def get_media(session: Session, media_id: str) -> MediaItem | None:
    """Look up one item by its stable TASTERA ID."""

    record = session.get(MediaItemRecord, media_id)
    return to_schema(record) if record else None
