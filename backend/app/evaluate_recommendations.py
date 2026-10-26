"""Compare app recommendation strategies against historical account signals.

Run from ``backend`` with the app database configured. This is a read-only,
leave-one-positive-item-out proxy evaluation: saves and ``more`` feedback are
positive outcomes, while ``less`` feedback removes a candidate. The app does
not yet record recommendation impressions, so results are not exposure-aware.
"""

from __future__ import annotations

import argparse
import math
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.database import SessionLocal
from app.models.account import RecommendationFeedbackRecord, SavedMediaRecord
from app.models.catalog import MediaEmbeddingRecord, MediaGenre, MediaItemRecord
from app.services.semantic_search import EMBEDDING_MODEL


@dataclass(frozen=True)
class PositiveSignal:
    account_id: str
    item_id: str
    occurred_at: datetime


@dataclass(frozen=True)
class EvaluationRow:
    account_id: str
    target_ids: frozenset[str]
    cutoff: datetime
    train_ids: frozenset[str]
    disliked_ids: frozenset[str]


def _genres(item: MediaItemRecord) -> set[str]:
    names = {link.genre.name.casefold().strip() for link in item.genre_links}
    if item.primary_genre:
        names.add(item.primary_genre.casefold().strip())
    names = {name for name in names if name}
    if item.category == "Music":
        names -= {"album", "unclassified", "unknown"}
    return names


def _load_signals(
    session: Session, category: str
) -> tuple[list[PositiveSignal], dict[str, dict[str, datetime]], list[PositiveSignal]]:
    saves = session.execute(
        select(SavedMediaRecord.account_id, SavedMediaRecord.media_item_id, SavedMediaRecord.saved_at)
        .join(MediaItemRecord, MediaItemRecord.id == SavedMediaRecord.media_item_id)
        .where(MediaItemRecord.category == category)
    ).all()
    feedback = session.execute(
        select(
            RecommendationFeedbackRecord.account_id,
            RecommendationFeedbackRecord.media_item_id,
            RecommendationFeedbackRecord.feedback,
            RecommendationFeedbackRecord.updated_at,
        )
        .join(MediaItemRecord, MediaItemRecord.id == RecommendationFeedbackRecord.media_item_id)
        .where(MediaItemRecord.category == category)
    ).all()

    event_at: dict[tuple[str, str], datetime] = {}
    peer_event_at: dict[tuple[str, str], datetime] = {}
    dislikes: dict[str, dict[str, datetime]] = defaultdict(dict)
    for account_id, item_id, saved_at in saves:
        event_at[(account_id, item_id)] = saved_at
        peer_event_at[(account_id, item_id)] = saved_at
    for account_id, item_id, value, updated_at in feedback:
        if value == "more":
            key = (account_id, item_id)
            event_at[key] = max(event_at.get(key, updated_at), updated_at)
            peer_event_at[key] = min(peer_event_at.get(key, updated_at), updated_at)
        elif value == "less":
            dislikes[account_id][item_id] = updated_at
            key = (account_id, item_id)
            if event_at.get(key, updated_at) <= updated_at:
                event_at.pop(key, None)

    positives = [
        PositiveSignal(account_id, item_id, occurred_at)
        for (account_id, item_id), occurred_at in event_at.items()
    ]
    peer_positives = [
        PositiveSignal(account_id, item_id, occurred_at)
        for (account_id, item_id), occurred_at in peer_event_at.items()
    ]
    return positives, dislikes, peer_positives


def _evaluation_rows(
    positives: list[PositiveSignal],
    dislikes: dict[str, dict[str, datetime]],
    minimum_history: int,
) -> list[EvaluationRow]:
    by_account: dict[str, list[PositiveSignal]] = defaultdict(list)
    for signal in positives:
        by_account[signal.account_id].append(signal)
    rows = []
    for account_id, signals in by_account.items():
        if len(signals) < minimum_history + 1:
            continue
        ordered = sorted(signals, key=lambda signal: (signal.occurred_at, signal.item_id))
        test_size = max(1, math.ceil(len(ordered) * 0.20))
        training, testing = ordered[:-test_size], ordered[-test_size:]
        cutoff = testing[0].occurred_at
        history = frozenset(signal.item_id for signal in training)
        if len(history) < minimum_history:
            continue
        rows.append(
            EvaluationRow(
                account_id=account_id,
                target_ids=frozenset(signal.item_id for signal in testing),
                cutoff=cutoff,
                train_ids=history,
                disliked_ids=frozenset(
                    item_id
                    for item_id, timestamp in dislikes.get(account_id, {}).items()
                    if timestamp < cutoff
                ),
            )
        )
    return rows


def _genre_ranking(
    row: EvaluationRow,
    items: dict[str, MediaItemRecord],
    candidates: list[MediaItemRecord],
) -> list[MediaItemRecord]:
    weights: Counter[str] = Counter()
    for item_id in row.train_ids:
        if item_id in items:
            weights.update(_genres(items[item_id]))
    ranked = []
    for item in candidates:
        labels = _genres(item)
        score = sum(weights[label] for label in labels) / max(len(labels), 1)
        if score > 0:
            ranked.append((score, item.title.casefold(), item.id, item))
    ranked.sort(key=lambda value: (-value[0], value[1], value[2]))
    return [value[3] for value in ranked]


def _item_item_ranking(
    row: EvaluationRow,
    candidates: list[MediaItemRecord],
    positive_by_account: dict[str, list[PositiveSignal]],
    *,
    shrinkage: float = 50.0,
) -> list[MediaItemRecord]:
    peer_items: dict[str, set[str]] = defaultdict(set)
    for peer_id, signals in positive_by_account.items():
        if peer_id == row.account_id:
            continue
        for signal in signals:
            if signal.occurred_at < row.cutoff:
                peer_items[peer_id].add(signal.item_id)
    item_accounts: dict[str, set[str]] = defaultdict(set)
    for peer_id, item_ids in peer_items.items():
        for item_id in item_ids:
            item_accounts[item_id].add(peer_id)

    ranked = []
    for candidate in candidates:
        candidate_accounts = item_accounts.get(candidate.id, set())
        score = 0.0
        for seed_id in row.train_ids:
            seed_accounts = item_accounts.get(seed_id, set())
            shared = len(candidate_accounts & seed_accounts)
            if shared < 2:
                continue
            cosine = shared / math.sqrt(len(candidate_accounts) * len(seed_accounts))
            score += cosine * shared / (shared + shrinkage)
        if score > 0:
            ranked.append((score, candidate.title.casefold(), candidate.id, candidate))
    ranked.sort(key=lambda value: (-value[0], value[1], value[2]))
    return [value[3] for value in ranked]


def _embedding_ranking(
    row: EvaluationRow,
    candidates: list[MediaItemRecord],
    vectors: dict[str, list[float]],
) -> list[MediaItemRecord]:
    """Rank candidates by cosine similarity to a training-history centroid."""

    seeds = [vectors[item_id] for item_id in row.train_ids if item_id in vectors]
    if not seeds:
        return []
    dimensions = len(seeds[0])
    profile = [sum(vector[index] for vector in seeds) / len(seeds) for index in range(dimensions)]
    norm = math.sqrt(sum(value * value for value in profile))
    if not norm:
        return []
    profile = [value / norm for value in profile]
    ranked = []
    for item in candidates:
        vector = vectors.get(item.id)
        if vector is None or len(vector) != dimensions:
            continue
        score = sum(left * right for left, right in zip(profile, vector, strict=True))
        ranked.append((score, item.title.casefold(), item.id, item))
    ranked.sort(key=lambda value: (-value[0], value[1], value[2]))
    return [value[3] for value in ranked]


def _diversity(items: list[MediaItemRecord]) -> float:
    if len(items) < 2:
        return 0.0
    pairs = [
        1.0 - len(_genres(left) & _genres(right)) / max(len(_genres(left) | _genres(right)), 1)
        for index, left in enumerate(items)
        for right in items[index + 1 :]
    ]
    return sum(pairs) / len(pairs)


def evaluate_category(
    session: Session,
    category: str,
    *,
    k: int = 12,
    minimum_history: int = 2,
) -> dict[str, object]:
    positives, dislikes, peer_positives = _load_signals(session, category)
    rows = _evaluation_rows(positives, dislikes, minimum_history)
    catalog = session.scalars(
        select(MediaItemRecord)
        .where(MediaItemRecord.category == category)
        .options(selectinload(MediaItemRecord.genre_links).joinedload(MediaGenre.genre))
    ).all()
    embedding_rows = session.scalars(
        select(MediaEmbeddingRecord)
        .join(MediaItemRecord, MediaItemRecord.id == MediaEmbeddingRecord.media_item_id)
        .where(
            MediaEmbeddingRecord.model_name == EMBEDDING_MODEL,
            MediaItemRecord.category == category,
        )
    ).all()
    vectors = {
        row.media_item_id: list(row.embedding)
        for row in embedding_rows
        if row.embedding is not None
    }
    items = {item.id: item for item in catalog}
    positive_by_account: dict[str, list[PositiveSignal]] = defaultdict(list)
    for signal in peer_positives:
        positive_by_account[signal.account_id].append(signal)

    if len(rows) < 5:
        return {
            "category": category,
            "catalog_items": len(catalog),
            "positive_events": len(positives),
            "eligible_accounts": len(rows),
            "embedding_items": len(vectors),
            "embedding_catalog_coverage": round(len(set(vectors) & set(items)) / max(len(items), 1), 4),
            "status": "insufficient data; need at least 5 eligible accounts",
        }

    embedding_coverage = len(set(vectors) & set(items)) / max(len(items), 1)
    methods = ["genre"]
    if catalog and embedding_coverage == 1.0:
        methods.append("embeddings")
    if category == "Movies":
        methods.append("item_item")
    coverage: dict[str, set[str]] = {name: set() for name in methods}
    hits: dict[str, list[float]] = {name: [] for name in methods}
    recalls: dict[str, list[float]] = {name: [] for name in methods}
    ndcgs: dict[str, list[float]] = {name: [] for name in methods}
    diversities: dict[str, list[float]] = {name: [] for name in methods}
    precisions: dict[str, list[float]] = {name: [] for name in methods}

    for row in rows:
        excluded = set(row.train_ids) | set(row.disliked_ids)
        candidates = [item for item in catalog if item.id not in excluded]
        rankings = {"genre": _genre_ranking(row, items, candidates)}
        if "embeddings" in methods:
            rankings["embeddings"] = _embedding_ranking(row, candidates, vectors)
        if category == "Movies":
            rankings["item_item"] = _item_item_ranking(
                row, candidates, positive_by_account
            )
        for method, ranking in rankings.items():
            top = ranking[:k]
            ranks = [
                index + 1
                for index, item in enumerate(top)
                if item.id in row.target_ids
            ]
            hits[method].append(float(bool(ranks)))
            precisions[method].append(len(ranks) / k)
            recall = len(ranks) / len(row.target_ids)
            dcg = sum(1.0 / math.log2(rank + 1) for rank in ranks)
            ideal = sum(
                1.0 / math.log2(rank + 1)
                for rank in range(1, min(k, len(row.target_ids)) + 1)
            )
            ndcgs[method].append(dcg / ideal if ideal else 0.0)
            recalls[method].append(recall)
            diversities[method].append(_diversity(top))
            coverage[method].update(item.id for item in top)

    results = {}
    for method in methods:
        results[method] = {
            "hit_rate_at_k": round(sum(hits[method]) / len(rows), 4),
            "precision_at_k": round(sum(precisions[method]) / len(rows), 4),
            "recall_at_k": round(sum(recalls[method]) / len(rows), 4),
            "ndcg_at_k": round(sum(ndcgs[method]) / len(rows), 4),
            "catalog_coverage": round(len(coverage[method]) / max(len(catalog), 1), 4),
            "mean_intra_list_diversity": round(sum(diversities[method]) / len(rows), 4),
        }
    return {
        "category": category,
        "catalog_items": len(catalog),
        "positive_events": len(positives),
        "eligible_accounts": len(rows),
        "embedding_items": len(vectors),
        "embedding_catalog_coverage": round(embedding_coverage, 4),
        "k": k,
        "method_results": results,
        "status": (
            "preliminary proxy; fewer than 30 eligible accounts and no logged impressions"
            if len(rows) < 30
            else "proxy evaluation; saved/positive-feedback events, not logged impressions"
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--category", choices=("Movies", "Books", "Music", "all"), default="all")
    parser.add_argument("--k", type=int, default=12)
    parser.add_argument("--minimum-history", type=int, default=2)
    args = parser.parse_args()
    if args.k < 1 or args.minimum_history < 1:
        parser.error("--k and --minimum-history must be positive")
    categories = ("Movies", "Books", "Music") if args.category == "all" else (args.category,)
    try:
        with SessionLocal() as session:
            for category in categories:
                print(evaluate_category(session, category, k=args.k, minimum_history=args.minimum_history))
    except Exception as error:
        parser.error(
            f"evaluation could not query the configured app database ({type(error).__name__}). "
            "Run after applying migrations with TASTERA_DATABASE_URL configured."
        )


if __name__ == "__main__":
    main()
