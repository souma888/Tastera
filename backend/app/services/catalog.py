"""Database-backed catalog query service."""

from math import ceil

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.models.catalog import MediaItemRecord
from app.schemas.media import MediaCategory, MediaItem, MediaPage


def to_schema(record: MediaItemRecord) -> MediaItem:
    """Translate a persistent record into the public API contract."""

    return MediaItem(
        id=record.id,
        title=record.title,
        creator=record.creator,
        category=MediaCategory(record.category),
        genre=record.primary_genre,
        image=record.artwork_url,
        description=record.description,
        connection=record.connection,
        source=record.source,
    )


def list_media(
    session: Session,
    *,
    category: MediaCategory | None,
    query: str | None,
    page: int,
    limit: int,
) -> MediaPage:
    """Return a deterministic filtered page from the catalog database."""

    statement: Select[tuple[MediaItemRecord]] = select(MediaItemRecord)
    if category:
        statement = statement.where(MediaItemRecord.category == category.value)

    if query:
        pattern = f"%{query.strip()}%"
        statement = statement.where(
            or_(
                MediaItemRecord.title.ilike(pattern),
                MediaItemRecord.creator.ilike(pattern),
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


def get_media(session: Session, media_id: str) -> MediaItem | None:
    """Look up one item by its stable TASTERA ID."""

    record = session.get(MediaItemRecord, media_id)
    return to_schema(record) if record else None
