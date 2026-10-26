"""Sentence Transformer embeddings and PostgreSQL vector retrieval."""

from __future__ import annotations

import hashlib
from functools import lru_cache
from os import getenv

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.database import DATABASE_URL
from app.models.catalog import MediaEmbeddingRecord, MediaGenre, MediaItemRecord
from app.schemas.media import MediaCategory
from app.services.catalog import to_schema


EMBEDDING_MODEL = getenv(
    "TASTERA_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
)
EMBEDDING_DIMENSIONS = 384


@lru_cache(maxsize=1)
def _model():
    """Load the CPU model on first use, not during API process startup."""

    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as error:
        raise RuntimeError(
            "Install backend requirements to enable semantic search."
        ) from error
    return SentenceTransformer(EMBEDDING_MODEL, device="cpu")


def item_text(item: MediaItemRecord) -> str:
    """Build the stable, non-editorial text used for catalog embeddings."""

    fields = [item.title, item.creator, item.category, item.primary_genre]
    if item.genre_links:
        fields.extend(link.genre.name for link in item.genre_links)
    if item.description:
        fields.append(item.description)
    return " | ".join(" ".join(value.split()) for value in fields if value and value.strip())[:4000]


def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def encode_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    vectors = _model().encode(
        texts,
        batch_size=32,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    if vectors.shape[1] != EMBEDDING_DIMENSIONS:
        raise RuntimeError(
            f"Embedding model must produce {EMBEDDING_DIMENSIONS} dimensions; got {vectors.shape[1]}."
        )
    return [[float(value) for value in vector] for vector in vectors]


def search_semantic(
    session: Session,
    query: str,
    *,
    category: MediaCategory | None,
    limit: int,
    exclude_ids: set[str] | None = None,
) -> list[tuple[MediaItemRecord, float]]:
    """Return nearest catalog records using pgvector cosine distance."""

    if not DATABASE_URL.startswith(("postgresql", "postgres")):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Semantic search requires PostgreSQL with pgvector; local SQLite supports the rest of the app.",
        )
    if session.scalar(
        select(MediaEmbeddingRecord.media_item_id)
        .where(MediaEmbeddingRecord.model_name == EMBEDDING_MODEL)
        .limit(1)
    ) is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The semantic index is empty; run `python -m app.embed_catalog` after migrations.",
        )
    try:
        vector = encode_texts([query])[0]
    except RuntimeError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)
        ) from error

    distance = MediaEmbeddingRecord.embedding.cosine_distance(vector)
    statement = (
        select(MediaItemRecord, distance.label("distance"))
        .join(MediaEmbeddingRecord, MediaEmbeddingRecord.media_item_id == MediaItemRecord.id)
        .where(MediaEmbeddingRecord.model_name == EMBEDDING_MODEL)
        .options(selectinload(MediaItemRecord.genre_links).joinedload(MediaGenre.genre))
    )
    if category:
        statement = statement.where(MediaItemRecord.category == category.value)
    if exclude_ids:
        statement = statement.where(~MediaItemRecord.id.in_(exclude_ids))
    rows = session.execute(statement.order_by(distance).limit(limit)).all()
    return [(item, max(-1.0, min(1.0, 1.0 - float(distance_value)))) for item, distance_value in rows]


def embed_catalog(session: Session, *, batch_size: int = 32, force: bool = False) -> dict[str, int]:
    """Generate missing/stale embeddings and persist vectors in the active DB."""

    records = session.scalars(
        select(MediaItemRecord).options(
            joinedload(MediaItemRecord.genre_links).joinedload(MediaGenre.genre),
            joinedload(MediaItemRecord.embedding),
        ).order_by(MediaItemRecord.id)
    ).unique().all()
    pending: list[tuple[MediaItemRecord, str, str]] = []
    skipped = 0
    for record in records:
        text = item_text(record)
        digest = content_hash(text)
        current = record.embedding
        if not force and current and current.model_name == EMBEDDING_MODEL and current.content_hash == digest:
            skipped += 1
            continue
        pending.append((record, text, digest))

    from app.models.catalog import MediaEmbeddingRecord

    added = 0
    updated = 0
    for start in range(0, len(pending), batch_size):
        batch = pending[start : start + batch_size]
        vectors = encode_texts([text for _, text, _ in batch])
        for (record, _, digest), vector in zip(batch, vectors, strict=True):
            embedding = record.embedding
            if embedding is None:
                embedding = MediaEmbeddingRecord(media_item_id=record.id)
                session.add(embedding)
                added += 1
            else:
                updated += 1
            embedding.model_name = EMBEDDING_MODEL
            embedding.content_hash = digest
            embedding.embedding = vector
    session.commit()
    return {"catalog_items": len(records), "added": added, "updated": updated, "skipped": skipped}


def query_vector(query: str) -> list[float]:
    """Expose the same encoder to the offline evaluator."""

    return encode_texts([query])[0]
