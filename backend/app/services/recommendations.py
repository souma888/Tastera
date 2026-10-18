"""Transparent genre-overlap recommendation service."""

from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.account import SavedMediaRecord
from app.models.catalog import MediaGenre, MediaItemRecord
from app.schemas.media import MediaCategory
from app.schemas.recommendations import Recommendation, RecommendationPage
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
    profile_genres: set[str] = set()
    saved_genres: dict[str, list[MediaItemRecord]] = {}
    for record in saved_records:
        for key in _genres(record):
            profile_genres.add(key)
            saved_genres.setdefault(key, []).append(record)

    if not profile_genres:
        return RecommendationPage(
            items=[],
            saved_count=len(saved_ids),
            message="Your saved items do not have genre details yet, so there are no reliable matches.",
        )

    statement = select(MediaItemRecord).where(~MediaItemRecord.id.in_(saved_ids))
    if category:
        statement = statement.where(MediaItemRecord.category == category.value)
    candidates = session.scalars(
        statement.options(selectinload(MediaItemRecord.genre_links).joinedload(MediaGenre.genre))
    ).all()

    ranked: list[tuple[float, str, str, MediaItemRecord, list[str], MediaItemRecord]] = []
    for candidate in candidates:
        candidate_genres = _genres(candidate)
        overlap = profile_genres.intersection(candidate_genres)
        if not overlap:
            continue
        score = len(overlap) / max(len(candidate_genres), 1)
        best_key = sorted(overlap)[0]
        source_item = sorted(
            saved_genres[best_key], key=lambda record: (record.title.casefold(), record.id)
        )[0]
        labels = sorted({candidate_genres[key] for key in overlap}, key=str.casefold)
        ranked.append((score, candidate.title.casefold(), candidate.id, candidate, labels, source_item))

    ranked.sort(key=lambda row: (-row[0], row[1], row[2]))
    recommendations = [
        Recommendation(
            item=to_schema(record),
            matched_genres=labels,
            reason=f"Because you saved {source_item.title}: both share {', '.join(labels)}.",
        )
        for _, _, _, record, labels, source_item in ranked[:limit]
    ]
    message = (
        "Matched to genres from your saved items."
        if recommendations
        else "No unsaved catalog items match the genres in your Library yet."
    )
    return RecommendationPage(
        items=recommendations, saved_count=len(saved_ids), message=message
    )
