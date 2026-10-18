"""Transparent genre-overlap recommendation service."""

from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.account import RecommendationFeedbackRecord, SavedMediaRecord
from app.models.catalog import MediaGenre, MediaItemRecord
from app.schemas.media import MediaCategory
from app.schemas.recommendations import (
    Recommendation,
    RecommendationFeedbackItem,
    RecommendationPage,
)
from app.services.catalog import to_schema


GENRE_ALIASES = {
    "sci-fi": "science fiction",
    "scifi": "science fiction",
    "science-fiction": "science fiction",
    "rom-com": "romance",
    "romantic comedy": "romance",
    "action & adventure": "action",
}


def _genre_key(label: str) -> str:
    normalized = " ".join(label.casefold().replace("_", " ").split())
    return GENRE_ALIASES.get(normalized, normalized)


def _genres(record: MediaItemRecord) -> dict[str, str]:
    labels = [link.genre.name for link in record.genre_links]
    if record.primary_genre:
        labels.append(record.primary_genre)
    return {_genre_key(label): label for label in labels if label.strip()}


def _load_records(session: Session, ids: Iterable[str]) -> list[MediaItemRecord]:
    return session.scalars(
        select(MediaItemRecord)
        .where(MediaItemRecord.id.in_(list(ids)))
        .options(selectinload(MediaItemRecord.genre_links).joinedload(MediaGenre.genre))
    ).all()


def recommend_for_account(
    session: Session,
    *,
    account_id: str,
    category: MediaCategory | None,
    limit: int,
) -> RecommendationPage:
    """Rank unsaved catalog items by overlap with the account's saved genres."""

    saved_ids = set(
        session.scalars(
            select(SavedMediaRecord.media_item_id).where(
                SavedMediaRecord.account_id == account_id
            )
        ).all()
    )
    if not saved_ids:
        return RecommendationPage(
            items=[],
            saved_count=0,
            message="Save a few items to your Library to get recommendations based on your taste.",
        )

    saved_records = _load_records(session, saved_ids)
    genre_weights: dict[str, int] = {}
    saved_genres: dict[str, list[MediaItemRecord]] = {}
    for record in saved_records:
        for key in _genres(record):
            genre_weights[key] = genre_weights.get(key, 0) + 1
            saved_genres.setdefault(key, []).append(record)

    feedback_rows = session.scalars(
        select(RecommendationFeedbackRecord).where(
            RecommendationFeedbackRecord.account_id == account_id
        ).order_by(
            RecommendationFeedbackRecord.updated_at.desc(),
            RecommendationFeedbackRecord.media_item_id,
        )
    ).all()
    feedback_by_id = {row.media_item_id: row.feedback for row in feedback_rows}
    feedback_records = _load_records(session, feedback_by_id)
    feedback_order = {row.media_item_id: index for index, row in enumerate(feedback_rows)}
    feedback_records.sort(key=lambda record: feedback_order.get(record.id, len(feedback_order)))
    feedback_by_genre: dict[str, list[MediaItemRecord]] = {}
    for record in feedback_records:
        feedback_value = feedback_by_id.get(record.id)
        weight = 2 if feedback_value == "more" else -1
        for key in _genres(record):
            genre_weights[key] = genre_weights.get(key, 0) + weight
            if weight > 0:
                feedback_by_genre.setdefault(key, []).append(record)

    positive_genres = {key for key, weight in genre_weights.items() if weight > 0}
    if not positive_genres:
        return RecommendationPage(
            items=[],
            feedback_items=[
                RecommendationFeedbackItem(
                    item=to_schema(record), feedback=feedback_by_id[record.id]
                )
                for record in feedback_records
            ],
            saved_count=len(saved_ids),
            message="Your feedback has narrowed your current genre matches. Save or mark more items you enjoy to broaden the picks.",
        )

    excluded_ids = saved_ids | {
        media_id for media_id, value in feedback_by_id.items() if value == "less"
    }
    statement = select(MediaItemRecord).where(~MediaItemRecord.id.in_(excluded_ids))
    if category:
        statement = statement.where(MediaItemRecord.category == category.value)
    candidates = session.scalars(
        statement.options(selectinload(MediaItemRecord.genre_links).joinedload(MediaGenre.genre))
    ).all()

    ranked: list[
        tuple[float, str, str, MediaItemRecord, list[str], MediaItemRecord, str]
    ] = []
    for candidate in candidates:
        candidate_genres = _genres(candidate)
        overlap = positive_genres.intersection(candidate_genres)
        if not overlap and candidate.id not in feedback_by_id:
            continue
        score = sum(genre_weights.get(key, 0) for key in candidate_genres) / max(
            len(candidate_genres), 1
        )
        if score <= 0 and candidate.id not in feedback_by_id:
            continue
        matched_keys = sorted(key for key in overlap if genre_weights.get(key, 0) > 0)
        if matched_keys:
            best_key = matched_keys[0]
            saved_sources = saved_genres.get(best_key, [])
            source_records = saved_sources or feedback_by_genre.get(best_key, [])
            source_item = sorted(
                source_records, key=lambda record: (record.title.casefold(), record.id)
            )[0]
            source_kind = "saved" if saved_sources else "feedback"
        else:
            source_item = candidate
            source_kind = "feedback"
        labels = sorted({candidate_genres[key] for key in matched_keys}, key=str.casefold)
        ranked.append(
            (
                score,
                candidate.title.casefold(),
                candidate.id,
                candidate,
                labels,
                source_item,
                source_kind,
            )
        )

    ranked.sort(key=lambda row: (-row[0], row[1], row[2]))
    recommendations = []
    for _, _, _, record, labels, source_item, source_kind in ranked[:limit]:
        if source_kind == "saved":
            reason = f"Because you saved {source_item.title}: both share {', '.join(labels)}."
        else:
            reason = f"Shaped by your request for more like {source_item.title}."
        recommendations.append(
            Recommendation(
                item=to_schema(record),
                matched_genres=labels,
                reason=reason,
                feedback=feedback_by_id.get(record.id),
            )
        )
    message = (
        "Ranked from genres in your Library and your recommendation feedback."
        if recommendations
        else "No unsaved catalog items match the genres in your Library yet."
    )
    return RecommendationPage(
        items=recommendations,
        feedback_items=[
            RecommendationFeedbackItem(
                item=to_schema(record), feedback=feedback_by_id[record.id]
            )
            for record in feedback_records
        ],
        saved_count=len(saved_ids),
        message=message,
    )
