"""Transparent genre-overlap recommendation service."""

from collections import defaultdict
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
UNCLASSIFIED_MUSIC_GENRES = {"album", "unclassified", "unknown"}


def _genre_key(label: str) -> str:
    normalized = " ".join(label.casefold().replace("_", " ").split())
    return GENRE_ALIASES.get(normalized, normalized)


def _genres(record: MediaItemRecord) -> dict[str, str]:
    labels = [link.genre.name for link in record.genre_links]
    if record.primary_genre:
        labels.append(record.primary_genre)
    normalized = {_genre_key(label): label for label in labels if label.strip()}
    if record.category == "Music":
        normalized = {
            key: label
            for key, label in normalized.items()
            if key not in UNCLASSIFIED_MUSIC_GENRES
        }
    return normalized


def _load_records(session: Session, ids: Iterable[str]) -> list[MediaItemRecord]:
    return session.scalars(
        select(MediaItemRecord)
        .where(MediaItemRecord.id.in_(list(ids)))
        .options(selectinload(MediaItemRecord.genre_links).joinedload(MediaGenre.genre))
    ).all()


def _feedback_for_account(
    session: Session, account_id: str
) -> tuple[dict[str, str], list[MediaItemRecord]]:
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
    return feedback_by_id, feedback_records


def _recommend_by_item_similarity(
    session: Session,
    *,
    account_id: str,
    category: MediaCategory | None,
    limit: int,
    offset: int,
    exclude_ids: set[str],
    saved_ids: set[str],
    saved_ratings: dict[str, int | None],
    feedback_by_id: dict[str, str],
    feedback_records: list[MediaItemRecord],
) -> RecommendationPage:
    """Rank candidates from co-saves across other accounts.

    Similarity uses binary co-preference cosine with the shrinkage value selected
    in the MovieLens validation experiment. Only pairs observed in at least two
    other accounts are used; account-level interactions never leave this service.
    """

    positive_ids = set(saved_ids) | {
        media_id for media_id, value in feedback_by_id.items() if value == "more"
    }
    positive_records = _load_records(session, positive_ids)
    seed_records = [record for record in positive_records if record.category == "Movies"]
    candidate_category = category or MediaCategory.MOVIES
    excluded_ids = saved_ids | exclude_ids | {
        media_id for media_id, value in feedback_by_id.items() if value == "less"
    }
    candidates = session.scalars(
        select(MediaItemRecord)
        .where(
            MediaItemRecord.category == candidate_category.value,
            ~MediaItemRecord.id.in_(excluded_ids),
        )
        .options(selectinload(MediaItemRecord.genre_links).joinedload(MediaGenre.genre))
    ).all()

    if not seed_records or not candidates:
        return RecommendationPage(
            items=[],
            feedback_items=[
                RecommendationFeedbackItem(
                    item=to_schema(record), feedback=feedback_by_id[record.id]
                )
                for record in feedback_records
            ],
            saved_count=len(saved_ids),
            method="item_item",
            message="The item-item model needs saved movies or ‘more’ feedback and supported co-save patterns in the catalog.",
        )

    # Build distinct account-to-item positive histories, excluding this account
    # from training to avoid using its own saves to manufacture similarity.
    interaction_rows = session.execute(
        select(SavedMediaRecord.account_id, SavedMediaRecord.media_item_id)
        .join(MediaItemRecord, SavedMediaRecord.media_item_id == MediaItemRecord.id)
        .where(
            SavedMediaRecord.account_id != account_id,
            MediaItemRecord.category == MediaCategory.MOVIES.value,
        )
    ).all()
    more_rows = session.execute(
        select(
            RecommendationFeedbackRecord.account_id,
            RecommendationFeedbackRecord.media_item_id,
        )
        .join(
            MediaItemRecord,
            RecommendationFeedbackRecord.media_item_id == MediaItemRecord.id,
        )
        .where(
            RecommendationFeedbackRecord.account_id != account_id,
            RecommendationFeedbackRecord.feedback == "more",
            MediaItemRecord.category == MediaCategory.MOVIES.value,
        )
    ).all()
    account_items: dict[str, set[str]] = defaultdict(set)
    for other_account_id, media_id in (*interaction_rows, *more_rows):
        account_items[other_account_id].add(media_id)

    item_accounts: dict[str, set[str]] = defaultdict(set)
    for other_account_id, media_ids in account_items.items():
        for media_id in media_ids:
            item_accounts[media_id].add(other_account_id)

    rating_weights = {1: -1.0, 2: -0.5, 3: 0.65, 4: 1.35, 5: 2.0}
    seed_weights = {
        record.id: rating_weights.get(saved_ratings.get(record.id), 1.0)
        * (1.5 if feedback_by_id.get(record.id) == "more" else 1.0)
        for record in seed_records
    }
    score_by_id: dict[str, float] = {}
    strongest_seed: dict[str, str] = {}
    shrinkage = 50.0
    for candidate in candidates:
        candidate_accounts = item_accounts.get(candidate.id, set())
        if not candidate_accounts:
            continue
        score = 0.0
        best_seed = ""
        best_contribution = 0.0
        for seed_id, weight in seed_weights.items():
            if seed_id == candidate.id or weight <= 0:
                continue
            seed_users = item_accounts.get(seed_id, set())
            shared = len(candidate_accounts & seed_users)
            if shared < 2:
                continue
            similarity = (shared / ((len(candidate_accounts) * len(seed_users)) ** 0.5))
            similarity *= shared / (shared + shrinkage)
            contribution = similarity * weight
            score += contribution
            if contribution > best_contribution:
                best_contribution = contribution
                best_seed = seed_id
        if score > 0:
            score_by_id[candidate.id] = score
            strongest_seed[candidate.id] = best_seed

    candidate_by_id = {record.id: record for record in candidates}
    ranked_ids = sorted(
        score_by_id,
        key=lambda media_id: (
            -score_by_id[media_id],
            candidate_by_id[media_id].title.casefold(),
            media_id,
        ),
    )
    total = len(ranked_ids)
    ranked_ids = ranked_ids[offset : offset + limit]
    recommendations = []
    for media_id in ranked_ids:
        record = candidate_by_id[media_id]
        source = next(
            (item for item in seed_records if item.id == strongest_seed[media_id]),
            record,
        )
        shared_genres = sorted(
            {genre for genre in _genres(source).keys() & _genres(record).keys()},
            key=str.casefold,
        )
        reason = f"Other Tastera members who liked {source.title} also saved this."
        recommendations.append(
            Recommendation(
                item=to_schema(record),
                matched_genres=shared_genres,
                reason=reason,
                feedback=feedback_by_id.get(record.id),
            )
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
        method="item_item",
        total=total,
        next_offset=offset + len(recommendations) if offset + len(recommendations) < total else None,
        message=(
            "Ranked with privacy-preserving co-save similarity across other Tastera accounts."
            if recommendations
            else "Not enough shared movie saves yet for item-item recommendations. Compare with the genre baseline or save more movies."
        ),
    )


def recommend_for_account(
    session: Session,
    *,
    account_id: str,
    category: MediaCategory | None,
    limit: int,
    offset: int = 0,
    exclude_ids: set[str] | None = None,
    strategy: str = "auto",
) -> RecommendationPage:
    """Rank unsaved catalog items by overlap with the account's saved genres."""

    saved_rows = session.scalars(
        select(SavedMediaRecord).where(SavedMediaRecord.account_id == account_id)
    ).all()
    saved_ids = {row.media_item_id for row in saved_rows}
    saved_ratings = {row.media_item_id: row.rating for row in saved_rows}
    excluded_recommendation_ids = exclude_ids or set()
    if not saved_ids:
        if strategy == "item_item":
            return RecommendationPage(
                items=[], saved_count=0, method="item_item",
                message="Save a few movies to seed item-item recommendations.",
            )
        return RecommendationPage(
            items=[],
            saved_count=0,
            message="Save a few items to your Library to get recommendations based on your taste.",
        )

    feedback_by_id, feedback_records = _feedback_for_account(session, account_id)
    if strategy == "item_item" and category not in {None, MediaCategory.MOVIES}:
        return RecommendationPage(
            items=[],
            feedback_items=[
                RecommendationFeedbackItem(
                    item=to_schema(record), feedback=feedback_by_id[record.id]
                )
                for record in feedback_records
            ],
            saved_count=len(saved_ids),
            method="item_item",
            message="The item-item model currently supports movie recommendations only.",
        )
    if strategy in {"auto", "item_item"} and category in {None, MediaCategory.MOVIES}:
        item_item_page = _recommend_by_item_similarity(
            session,
            account_id=account_id,
            category=category,
            limit=limit,
            offset=offset,
            exclude_ids=excluded_recommendation_ids,
            saved_ids=saved_ids,
            saved_ratings=saved_ratings,
            feedback_by_id=feedback_by_id,
            feedback_records=feedback_records,
        )
        if strategy == "item_item" or item_item_page.items:
            return item_item_page

    saved_records = _load_records(session, saved_ids)
    genre_weights: dict[str, float] = {}
    saved_genres: dict[str, list[MediaItemRecord]] = {}
    for record in saved_records:
        rating_weight = {
            1: -2.0,
            2: -1.0,
            3: 0.5,
            4: 2.0,
            5: 3.0,
        }.get(saved_ratings.get(record.id), 1.0)
        for key in _genres(record):
            genre_weights[key] = genre_weights.get(key, 0) + rating_weight
            if rating_weight > 0:
                saved_genres.setdefault(key, []).append(record)

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
            method="genre",
            message="Your feedback has narrowed your current genre matches. Save or mark more items you enjoy to broaden the picks.",
        )

    excluded_ids = saved_ids | excluded_recommendation_ids | {
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
    total = len(ranked)
    recommendations = []
    for _, _, _, record, labels, source_item, source_kind in ranked[offset : offset + limit]:
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
        method="genre",
        total=total,
        next_offset=offset + len(recommendations) if offset + len(recommendations) < total else None,
        message=message,
    )
