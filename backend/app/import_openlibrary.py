"""Import selected books from Open Library monthly data dumps.

Open Library recommends its monthly dumps for imports and says its APIs are
not intended to act as a third-party service's catalog backend. This importer
streams the Works and Authors dumps, stores only metadata, and deliberately
does not reuse cover images whose rights have not been verified.
"""

from __future__ import annotations

import argparse
import gzip
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
from app.models.catalog import Genre, MediaGenre, MediaIdentifier, MediaItemRecord


PROVIDER = "openlibrary-work"
SOURCE = "Open Library"
DEFAULT_SUBJECTS = "science fiction,fantasy,mystery,thriller,literature"
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
)


@dataclass
class ImportSummary:
    added: int = 0
    updated: int = 0
    skipped: int = 0


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
) -> str:
    key = record.get("key")
    title = record.get("title")
    if not isinstance(key, str) or not key.startswith("/works/") or not isinstance(title, str):
        return "skipped"
    title = title.strip()
    authors = _author_names(record, author_index)
    selected_genre = _genre(_subject_names(record), selected_subjects)
    if not title or len(title) > 500 or not authors or selected_genre is None:
        return "skipped"
    creator = ", ".join(authors)[:500]
    external_id = key.removeprefix("/works/")
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
            description=_description(record.get("description")),
            artwork_url=None,
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
    media.description = _description(record.get("description"))
    media.artwork_url = None
    media.connection = "Imported from Open Library; Tastera's editorial connection has not been reviewed."
    media.source = SOURCE
    media.genre_links.clear()
    media.genre_links.append(MediaGenre(genre=genre))
    return "updated"


def import_books(
    *,
    works_path: Path,
    authors_path: Path,
    limit: int = 500,
    subjects: tuple[str, ...] = (),
) -> ImportSummary:
    if not works_path.is_file() or not authors_path.is_file():
        raise FileNotFoundError("Both Open Library Works and Authors dump files must exist.")
    if limit < 1 or limit > 5000:
        raise ValueError("limit must be between 1 and 5000")

    summary = ImportSummary()
    with tempfile.TemporaryDirectory(prefix="tastera-openlibrary-") as temp_dir:
        author_db = Path(temp_dir) / "authors.sqlite3"
        author_count = _index_authors(authors_path, author_db)
        if author_count == 0:
            raise ValueError("The Authors dump contained no usable author records.")
        with closing(sqlite3.connect(author_db)) as author_index, SessionLocal() as session:
            author_index.execute("PRAGMA query_only = ON")
            for record in _iter_dump(works_path):
                try:
                    outcome = _upsert_book(session, record, author_index, subjects)
                    if outcome == "skipped":
                        summary.skipped += 1
                        continue
                    session.commit()
                    if outcome == "added":
                        summary.added += 1
                    else:
                        summary.updated += 1
                    if summary.added + summary.updated >= limit:
                        break
                except (KeyError, TypeError, ValueError):
                    session.rollback()
                    summary.skipped += 1
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--works", required=True, type=Path, help="Path to the Open Library Works dump (.txt or .txt.gz).")
    parser.add_argument("--authors", required=True, type=Path, help="Path to the Open Library Authors dump (.txt or .txt.gz).")
    parser.add_argument("--limit", type=int, default=500, help="Maximum new or updated books to import (1–5000).")
    parser.add_argument("--subjects", default=DEFAULT_SUBJECTS, help="Comma-separated subject filter; blank imports any classified work.")
    args = parser.parse_args()
    subjects = tuple(subject.strip().casefold() for subject in args.subjects.split(",") if subject.strip())
    try:
        summary = import_books(
            works_path=args.works,
            authors_path=args.authors,
            limit=args.limit,
            subjects=subjects,
        )
    except (FileNotFoundError, ValueError) as error:
        parser.error(str(error))
    print(
        f"Open Library import complete: {summary.added} added, "
        f"{summary.updated} updated, {summary.skipped} skipped."
    )


if __name__ == "__main__":
    main()
