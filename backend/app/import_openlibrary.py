"""Import popular, cover-backed books from Open Library monthly data dumps.

Open Library recommends its monthly dumps for imports and says its APIs are
not intended to act as a third-party service's catalog backend. This importer
uses the Works, Authors, and Ratings dumps to select books with real reader
ratings, then scans the full Works dump instead of stopping at its first rows.
It stores metadata and links to Open Library-hosted cover images.
"""

from __future__ import annotations

import argparse
import gzip
import heapq
import json
import sqlite3
import tempfile
from contextlib import closing
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator, TextIO

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.account import RecommendationFeedbackRecord, SavedMediaRecord
from app.models.catalog import Genre, MediaGenre, MediaIdentifier, MediaItemRecord
from app.services.import_tracking import catalog_import_run


PROVIDER = "openlibrary-work"
SOURCE = "Open Library"
DEFAULT_SUBJECTS = (
    "science fiction,fantasy,mystery,thriller,romance,horror,historical fiction,"
    "young adult,biography,memoir,history,popular science,psychology,literature"
)
SUBJECT_GENRES = (
    ("science fiction", "Science Fiction"),
    ("sci-fi", "Science Fiction"),
    ("fantasy", "Fantasy"),
    ("mystery", "Mystery"),
    ("detective", "Mystery"),
    ("thriller", "Thriller"),
    ("horror", "Horror"),
    ("romance", "Romance"),
    ("historical fiction", "Historical Fiction"),
    ("literature", "Literature"),
    ("fiction", "Fiction"),
    ("nonfiction", "Nonfiction"),
    ("young adult", "Young Adult"),
    ("biography", "Biography"),
    ("memoir", "Memoir"),
    ("history", "History"),
    ("popular science", "Science"),
    ("psychology", "Psychology"),
)


@dataclass
class ImportSummary:
    added: int = 0
    updated: int = 0
    skipped: int = 0
    run_id: int | None = None


def _open_text(path: Path) -> TextIO:
    if path.suffix.lower() == ".gz":
        return gzip.open(path, "rt", encoding="utf-8")
    return path.open("r", encoding="utf-8")


def _iter_dump(path: Path) -> Iterator[dict[str, Any]]:
    """Yield decoded records from an Open Library four-column dump file."""

    with _open_text(path) as source:
        for line in source:
            columns = line.rstrip("\n").split("\t", 4)
            if len(columns) != 5:
                continue
            try:
                record = json.loads(columns[4])
            except json.JSONDecodeError:
                continue
            if isinstance(record, dict):
                yield record


def _index_authors(path: Path, database_path: Path) -> int:
    count = 0
    with closing(sqlite3.connect(database_path)) as database:
        database.execute("CREATE TABLE authors (key TEXT PRIMARY KEY, name TEXT NOT NULL)")
        with database:
            for record in _iter_dump(path):
                key = record.get("key")
                name = record.get("name")
                if isinstance(key, str) and isinstance(name, str) and name.strip():
                    database.execute(
                        "INSERT OR REPLACE INTO authors (key, name) VALUES (?, ?)",
                        (key, name.strip()),
                    )
                    count += 1
    return count


def _index_ratings(path: Path, database_path: Path) -> int:
    """Build per-work rating counts and sums from the Open Library Ratings dump."""

    rows = 0
    batch: dict[str, tuple[int, float]] = {}
    with closing(sqlite3.connect(database_path)) as database:
        database.execute(
            "CREATE TABLE ratings (work_key TEXT PRIMARY KEY, rating_count INTEGER NOT NULL, rating_sum REAL NOT NULL)"
        )

        def flush() -> None:
            if not batch:
                return
            database.executemany(
                """
                INSERT INTO ratings (work_key, rating_count, rating_sum)
                VALUES (?, ?, ?)
                ON CONFLICT(work_key) DO UPDATE SET
                    rating_count = rating_count + excluded.rating_count,
                    rating_sum = rating_sum + excluded.rating_sum
                """,
                [(key, count, total) for key, (count, total) in batch.items()],
            )
            batch.clear()

        with database:
            for line in _open_text(path):
                fields = line.rstrip("\n").split("\t")
                if len(fields) < 2 or not fields[0].startswith("/works/"):
                    continue
                rating = None
                for value in fields[1:]:
                    try:
                        parsed = float(value)
                    except ValueError:
                        continue
                    if 0.5 <= parsed <= 5 and parsed * 2 % 1 == 0:
                        rating = parsed
                        break
                if rating is None:
                    continue
                key = fields[0]
                count, total = batch.get(key, (0, 0.0))
                batch[key] = (count + 1, total + rating)
                rows += 1
                if len(batch) >= 25_000:
                    flush()
            flush()
    return rows


def _popular_work_candidates(
    works_path: Path,
    authors: sqlite3.Connection,
    rating_db_path: Path,
    selected_subjects: tuple[str, ...],
    *,
    limit: int,
    minimum_ratings: int,
    minimum_average: float,
) -> tuple[list[tuple[dict[str, Any], str, int, int, float]], int]:
    """Keep the most-read eligible works, ranked by reader-rating counts."""

    with closing(sqlite3.connect(rating_db_path)) as rating_db:
        ratings = {
            row[0]: (row[1], row[2] / row[1])
            for row in rating_db.execute(
                "SELECT work_key, rating_count, rating_sum FROM ratings WHERE rating_count >= ?",
                (minimum_ratings,),
            )
        }

    heap: list[tuple[int, float, str, dict[str, Any], str, int]] = []
    scanned = 0
    for record in _iter_dump(works_path):
        scanned += 1
        key = record.get("key")
        title = record.get("title")
        if not isinstance(key, str) or not key.startswith("/works/") or not isinstance(title, str):
            continue
        title = title.strip()
        if not title or len(title) > 300 or not any(character.isalpha() for character in title):
            continue
        selected_genre = _genre(_subject_names(record), selected_subjects)
        if selected_genre is None:
            continue
        popularity = ratings.get(key)
        if popularity is None or popularity[1] < minimum_average:
            continue
        covers = record.get("covers")
        cover_id = next(
            (value for value in covers if isinstance(value, int) and value > 0), None
        ) if isinstance(covers, list) else None
        if cover_id is None or not _author_names(record, authors):
            continue
        rating_count, rating_average = popularity
        candidate = (rating_count, rating_average, key, record, selected_genre, cover_id)
        if len(heap) < limit:
            heapq.heappush(heap, candidate)
        elif candidate[:3] > heap[0][:3]:
            heapq.heapreplace(heap, candidate)

    heap.sort(key=lambda candidate: (-candidate[0], -candidate[1], candidate[2]))
    return [
        (record, genre, cover_id, count, average)
        for count, average, _key, record, genre, cover_id in heap
    ], scanned


def _subject_names(record: dict[str, Any]) -> list[str]:
    subjects = record.get("subjects", [])
    if not isinstance(subjects, list):
        return []
    return [subject.strip() for subject in subjects if isinstance(subject, str) and subject.strip()]


def _genre(subjects: list[str], selected_subjects: tuple[str, ...]) -> str | None:
    lowered = [subject.casefold() for subject in subjects]
    if selected_subjects and not any(
        selected in subject for selected in selected_subjects for subject in lowered
    ):
        return None
    for needle, genre in SUBJECT_GENRES:
        if any(needle in subject for subject in lowered):
            return genre
    return "Unclassified"


def _description(value: Any) -> str | None:
    if isinstance(value, dict):
        value = value.get("value")
    if isinstance(value, str):
        return value.strip()[:4000] or None
    return None


def _author_names(record: dict[str, Any], authors: sqlite3.Connection) -> list[str]:
    names: list[str] = []
    entries = record.get("authors", [])
    if not isinstance(entries, list):
        return names
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        author = entry.get("author", entry)
        key = author.get("key") if isinstance(author, dict) else None
        if isinstance(key, str):
            row = authors.execute("SELECT name FROM authors WHERE key = ?", (key,)).fetchone()
            if row and row[0] not in names:
                names.append(row[0])
    return names


def _get_genre(session: Session, name: str) -> Genre:
    genre = session.scalar(select(Genre).where(Genre.name == name))
    if genre is None:
        genre = Genre(name=name)
        session.add(genre)
        session.flush()
    return genre


def _upsert_book(
    session: Session,
    record: dict[str, Any],
    author_index: sqlite3.Connection,
    selected_subjects: tuple[str, ...],
    *,
    selected_genre: str | None = None,
    popularity: tuple[int, float] | None = None,
) -> str:
    key = record.get("key")
    title = record.get("title")
    if not isinstance(key, str) or not key.startswith("/works/") or not isinstance(title, str):
        return "skipped"
    title = title.strip()
    authors = _author_names(record, author_index)
    selected_genre = selected_genre or _genre(_subject_names(record), selected_subjects)
    if not title or len(title) > 500 or not authors or selected_genre is None:
        return "skipped"
    creator = ", ".join(authors)[:500]
    external_id = key.removeprefix("/works/")
    covers = record.get("covers")
    cover_id = next(
        (value for value in covers if isinstance(value, int) and value > 0), None
    ) if isinstance(covers, list) else None
    artwork_url = (
        f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg?default=false"
        if cover_id is not None
        else None
    )
    description = _description(record.get("description"))
    if popularity:
        rating_count, rating_average = popularity
        rating_note = f"Open Library reader ratings: {rating_average:.1f}/5 from {rating_count:,} ratings."
        description = f"{description}\n\n{rating_note}" if description else rating_note
    identifier = session.scalar(
        select(MediaIdentifier).where(
            MediaIdentifier.provider == PROVIDER,
            MediaIdentifier.external_id == external_id,
        )
    )
    media = session.get(MediaItemRecord, identifier.media_item_id) if identifier else None
    genre = _get_genre(session, selected_genre)
    if media is None:
        media = MediaItemRecord(
            id=f"openlibrary-work-{external_id}"[:100],
            title=title,
            creator=creator,
            category="Books",
            primary_genre=selected_genre,
            description=description,
            artwork_url=artwork_url,
            connection="Imported from Open Library; Tastera's editorial connection has not been reviewed.",
            source=SOURCE,
            identifiers=[MediaIdentifier(provider=PROVIDER, external_id=external_id)],
            genre_links=[MediaGenre(genre=genre)],
        )
        session.add(media)
        return "added"

    media.title = title
    media.creator = creator
    media.category = "Books"
    media.primary_genre = selected_genre
    media.description = description
    media.artwork_url = artwork_url
    media.connection = "Imported from Open Library; Tastera's editorial connection has not been reviewed."
    media.source = SOURCE
    media.genre_links.clear()
    media.genre_links.append(MediaGenre(genre=genre))
    return "updated"


def import_books(
    *,
    works_path: Path,
    authors_path: Path,
    ratings_path: Path,
    limit: int = 500,
    subjects: tuple[str, ...] = (),
    minimum_ratings: int = 10,
    minimum_average: float = 3.5,
    prune_unselected: bool = False,
) -> ImportSummary:
    if not works_path.is_file() or not authors_path.is_file() or not ratings_path.is_file():
        raise FileNotFoundError("Open Library Works, Authors, and Ratings dump files must all exist.")
    if limit < 1 or limit > 5000:
        raise ValueError("limit must be between 1 and 5000")
    if minimum_ratings < 1:
        raise ValueError("minimum-ratings must be at least 1")
    if not 0 <= minimum_average <= 5:
        raise ValueError("minimum-average must be between 0 and 5")

    summary = ImportSummary()
    with tempfile.TemporaryDirectory(prefix="tastera-openlibrary-") as temp_dir:
        author_db = Path(temp_dir) / "authors.sqlite3"
        ratings_db = Path(temp_dir) / "ratings.sqlite3"
        author_count = _index_authors(authors_path, author_db)
        if author_count == 0:
            raise ValueError("The Authors dump contained no usable author records.")
        rating_rows = _index_ratings(ratings_path, ratings_db)
        if rating_rows == 0:
            raise ValueError("The Ratings dump contained no usable work ratings.")
        with closing(sqlite3.connect(author_db)) as author_index, SessionLocal() as session:
            author_index.execute("PRAGMA query_only = ON")
            candidates, scanned = _popular_work_candidates(
                works_path,
                author_index,
                ratings_db,
                subjects,
                limit=limit,
                minimum_ratings=minimum_ratings,
                minimum_average=minimum_average,
            )
            with catalog_import_run(session, PROVIDER) as run:
                summary.run_id = run.id
                selected_ids: set[str] = set()
                for record, genre_name, cover_id, rating_count, rating_average in candidates:
                    external_id = str(record["key"]).removeprefix("/works/")
                    selected_ids.add(f"openlibrary-work-{external_id}"[:100])
                    try:
                        outcome = _upsert_book(
                            session,
                            record,
                            author_index,
                            subjects,
                            selected_genre=genre_name,
                            popularity=(rating_count, rating_average),
                        )
                        if outcome == "skipped":
                            summary.skipped += 1
                            run.skipped += 1
                            continue
                        if outcome == "added":
                            summary.added += 1
                            run.added += 1
                        else:
                            summary.updated += 1
                            run.updated += 1
                        session.commit()
                        if summary.added + summary.updated >= limit:
                            break
                    except (KeyError, TypeError, ValueError):
                        session.rollback()
                        summary.skipped += 1
                        run.skipped += 1
                if prune_unselected and selected_ids:
                    saved_ids = select(SavedMediaRecord.media_item_id)
                    feedback_ids = select(RecommendationFeedbackRecord.media_item_id)
                    unselected = session.scalars(
                        select(MediaItemRecord).where(
                            MediaItemRecord.id.like("openlibrary-work-%"),
                            MediaItemRecord.source == SOURCE,
                            MediaItemRecord.id.not_in(selected_ids),
                            MediaItemRecord.id.not_in(saved_ids),
                            MediaItemRecord.id.not_in(feedback_ids),
                        )
                    ).all()
                    for item in unselected:
                        session.delete(item)
                    session.commit()
                print(
                    f"Selected {len(candidates)} popular, covered works from {scanned:,} scanned works; "
                    f"indexed {rating_rows:,} reader ratings (minimum {minimum_ratings} ratings, "
                    f"average {minimum_average:.1f}/5)."
                )
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--works", required=True, type=Path, help="Path to the Open Library Works dump (.txt or .txt.gz).")
    parser.add_argument("--authors", required=True, type=Path, help="Path to the Open Library Authors dump (.txt or .txt.gz).")
    parser.add_argument("--ratings", required=True, type=Path, help="Path to the Open Library Ratings dump (.txt or .txt.gz).")
    parser.add_argument("--limit", type=int, default=500, help="Maximum highest-rated eligible works to import (1–5000).")
    parser.add_argument("--minimum-ratings", type=int, default=10, help="Minimum reader ratings required for a work.")
    parser.add_argument("--minimum-average", type=float, default=3.5, help="Minimum average Open Library rating, from 0 to 5.")
    parser.add_argument("--subjects", default=DEFAULT_SUBJECTS, help="Comma-separated subject filter; blank imports any classified work.")
    parser.add_argument("--prune-unselected", action="store_true", help="Remove prior imported Open Library works outside the selected popular set, but preserve anything saved or feedback-rated by an account.")
    args = parser.parse_args()
    subjects = tuple(subject.strip().casefold() for subject in args.subjects.split(",") if subject.strip())
    try:
        summary = import_books(
            works_path=args.works,
            authors_path=args.authors,
            ratings_path=args.ratings,
            limit=args.limit,
            subjects=subjects,
            minimum_ratings=args.minimum_ratings,
            minimum_average=args.minimum_average,
            prune_unselected=args.prune_unselected,
        )
    except (FileNotFoundError, ValueError) as error:
        parser.error(str(error))
    print(
        f"Open Library import run {summary.run_id} complete: {summary.added} added, "
        f"{summary.updated} updated, {summary.skipped} skipped."
    )


if __name__ == "__main__":
    main()
