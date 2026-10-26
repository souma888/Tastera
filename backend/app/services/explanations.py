"""Generate optional LLM phrasing while preserving server-built evidence."""

from __future__ import annotations

import json
from os import getenv
import re

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.models.catalog import MediaEmbeddingRecord, MediaGenre, MediaItemRecord
from app.schemas.ai import ConnectionEvidence, ConnectionExplanation
from app.services.semantic_search import EMBEDDING_MODEL


def _creator_key(value: str) -> str:
    return " ".join(re.sub(r"[^\w]+", " ", value.casefold()).split())


def _evidence_for(
    session: Session, source: MediaItemRecord, target: MediaItemRecord
) -> list[ConnectionEvidence]:
    evidence: list[ConnectionEvidence] = []
    if _creator_key(source.creator) and _creator_key(source.creator) == _creator_key(target.creator):
        evidence.append(ConnectionEvidence(kind="creator", label="Shared creator credit", value=source.creator))

    def genres(item: MediaItemRecord) -> dict[str, str]:
        values = {link.genre.name.casefold().strip(): link.genre.name for link in item.genre_links}
        if item.primary_genre:
            values[item.primary_genre.casefold().strip()] = item.primary_genre
        return {key: value for key, value in values.items() if key}

    shared = genres(source).keys() & genres(target).keys()
    for key in sorted(shared):
        evidence.append(ConnectionEvidence(kind="genre", label="Shared catalog genre", value=genres(source)[key]))

    try:
        vectors = session.scalars(
            select(MediaEmbeddingRecord).where(
                MediaEmbeddingRecord.media_item_id.in_([source.id, target.id]),
                MediaEmbeddingRecord.model_name == EMBEDDING_MODEL,
            )
        ).all()
    except SQLAlchemyError:
        vectors = []
    vector_by_id = {row.media_item_id: list(row.embedding) for row in vectors if row.embedding is not None}
    if source.id in vector_by_id and target.id in vector_by_id:
        left, right = vector_by_id[source.id], vector_by_id[target.id]
        score = sum(a * b for a, b in zip(left, right, strict=True))
        if score >= 0.35:
            evidence.append(ConnectionEvidence(
                kind="semantic_similarity",
                label="Semantic similarity (model inference)",
                value=f"Catalog metadata cosine similarity: {score:.2f}",
            ))
    return evidence


def _deterministic_phrase(source: MediaItemRecord, target: MediaItemRecord, evidence: list[ConnectionEvidence]) -> str:
    grounds = [item.value for item in evidence if item.kind in {"creator", "genre"}]
    semantic = any(item.kind == "semantic_similarity" for item in evidence)
    details = ", ".join(grounds)
    if details and semantic:
        return f"These entries share {details}, and their catalog descriptions are also close in the semantic model."
    if details:
        return f"These entries share {details} in their catalog metadata."
    if semantic:
        return "Their catalog metadata is close in the semantic model; this is a similarity signal, not a factual relationship."
    return f"No shared creator, genre, or strong semantic signal is recorded between {source.title} and {target.title}."


def explain_connection(
    session: Session, source_id: str, target_id: str
) -> ConnectionExplanation | None:
    records = session.scalars(
        select(MediaItemRecord)
        .where(MediaItemRecord.id.in_([source_id, target_id]))
        .options(selectinload(MediaItemRecord.genre_links).joinedload(MediaGenre.genre))
    ).all()
    by_id = {record.id: record for record in records}
    source, target = by_id.get(source_id), by_id.get(target_id)
    if source is None or target is None or source.id == target.id:
        return None

    evidence = _evidence_for(session, source, target)
    fallback = _deterministic_phrase(source, target, evidence)
    api_key = getenv("OPENAI_API_KEY")
    if not api_key or not evidence:
        return ConnectionExplanation(explanation=fallback, generated=False, evidence=evidence)

    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key, timeout=8.0, max_retries=0)
        response = client.responses.create(
            model=getenv("TASTERA_EXPLANATION_MODEL", "gpt-4.1-mini"),
            instructions=(
                "Write one concise sentence (at most 30 words) that only paraphrases the supplied "
                "structured evidence. Do not infer facts, credits, causes, influence, or taste. "
                "If a signal is model-inferred, call it semantic similarity, not a verified relationship."
            ),
            input=json.dumps({
                "source": {"title": source.title, "category": source.category},
                "target": {"title": target.title, "category": target.category},
                "structured_evidence": [row.model_dump() for row in evidence],
            }),
            max_output_tokens=70,
            store=False,
        )
        text = " ".join(response.output_text.split())[:240]
        if text:
            return ConnectionExplanation(explanation=text, generated=True, evidence=evidence)
    except Exception:
        # Keep the discovery flow available if the optional provider is down.
        pass
    return ConnectionExplanation(explanation=fallback, generated=False, evidence=evidence)
