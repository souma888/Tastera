"""Import album release-group metadata from MusicBrainz core data.

The importer uses only core fields (CC0), never reads supplementary tag or
genre fields, sends an identifying User-Agent, and enforces MusicBrainz's
one-request-per-second API limit. Artwork is omitted because Cover Art Archive
images remain copyrighted by their owners.
"""

from __future__ import annotations

import argparse
import time
from dataclasses import dataclass
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.catalog import Genre, MediaGenre, MediaIdentifier, MediaItemRecord
from app.services.import_tracking import catalog_import_run


API_URL = "https://musicbrainz.org/ws/2/release-group"
PROVIDER = "musicbrainz-release-group"
SOURCE = "MusicBrainz core (CC0)"
MIN_REQUEST_DELAY = 1.1
USER_AGENT = "Tastera/0.1 (https://soumadip-tastera.vercel.app/)"


@dataclass
class ImportSummary:
    added: int = 0
    updated: int = 0
    skipped: int = 0
    run_id: int | None = None


class RateLimitedClient:
    """MusicBrainz client with an identifying header and request pacing."""

    def __init__(self, client: httpx.Client, delay: float) -> None:
        self.client = client
        self.delay = max(delay, MIN_REQUEST_DELAY)
        self.last_request = 0.0

    def search(self, *, query: str, offset: int) -> dict[str, Any]:
        wait = self.delay - (time.monotonic() - self.last_request)
        if wait > 0:
            time.sleep(wait)
        for attempt in range(4):
            self.last_request = time.monotonic()
            response = self.client.get(
                API_URL,
                params={"query": query, "fmt": "json", "limit": 100, "offset": offset},
            )
            if response.status_code in (429, 503) or response.status_code >= 500:
                if attempt == 3:
                    response.raise_for_status()
                retry_after = response.headers.get("Retry-After")
                try:
                    retry_delay = float(retry_after) if retry_after else self.delay * (2**attempt)
                except ValueError:
                    retry_delay = self.delay * (2**attempt)
                time.sleep(max(self.delay, retry_delay))
                continue
            response.raise_for_status()
            payload = response.json()
            return payload if isinstance(payload, dict) else {}
        return {}


def _artist_credit(value: Any) -> str:
    if not isinstance(value, list):
        return ""
    parts: list[str] = []
    for entry in value:
        if isinstance(entry, dict):
            artist = entry.get("artist")
            name = entry.get("name") or (artist.get("name") if isinstance(artist, dict) else None)
            if isinstance(name, str) and name.strip():
                parts.append(name.strip())
            joinphrase = entry.get("joinphrase")
            if isinstance(joinphrase, str):
                parts.append(joinphrase)
    return "".join(parts).strip()


def _get_genre(session: Session, name: str) -> Genre:
    genre = session.scalar(select(Genre).where(Genre.name == name))
    if genre is None:
        genre = Genre(name=name)
        session.add(genre)
        session.flush()
    return genre


def _upsert_release_group(
    session: Session,
    item: dict[str, Any],
    genre_name: str,
) -> str:
    external_id = item.get("id")
    title = item.get("title")
    creator = _artist_credit(item.get("artist-credit"))
    if not isinstance(external_id, str) or not isinstance(title, str) or not creator:
        return "skipped"
    title = title.strip()
    creator = creator[:500]
    if not title or len(title) > 500:
        return "skipped"

    identifier = session.scalar(
        select(MediaIdentifier).where(
            MediaIdentifier.provider == PROVIDER,
            MediaIdentifier.external_id == external_id,
        )
    )
    media = session.get(MediaItemRecord, identifier.media_item_id) if identifier else None
    genre = _get_genre(session, genre_name)
    date = item.get("first-release-date")
    description = f"Album metadata from MusicBrainz. First release date: {date}." if date else "Album metadata from MusicBrainz."
    connection = "Imported from MusicBrainz core metadata; Tastera's editorial connection has not been reviewed."

    if media is None:
        media = MediaItemRecord(
            id=f"musicbrainz-rg-{external_id}"[:100],
            title=title,
            creator=creator,
            category="Music",
            primary_genre=genre_name,
            description=description,
            artwork_url=None,
            connection=connection,
            source=SOURCE,
            identifiers=[MediaIdentifier(provider=PROVIDER, external_id=external_id)],
            genre_links=[MediaGenre(genre=genre)],
        )
        session.add(media)
        return "added"

    media.title = title
    media.creator = creator
    media.category = "Music"
    media.primary_genre = genre_name
    media.description = description
    media.artwork_url = None
    media.connection = connection
    media.source = SOURCE
    media.genre_links.clear()
    media.genre_links.append(MediaGenre(genre=genre))
    return "updated"


def import_albums(
    *,
    query: str = "primarytype:album",
    pages: int = 1,
    genre: str = "Album",
    request_delay: float = MIN_REQUEST_DELAY,
) -> ImportSummary:
    if not query.strip():
        raise ValueError("query cannot be blank")
    if pages < 1 or pages > 10:
        raise ValueError("pages must be between 1 and 10")
    if len(genre) > 100:
        raise ValueError("genre must be 100 characters or fewer")
    if request_delay < MIN_REQUEST_DELAY:
        raise ValueError(f"request-delay cannot be less than {MIN_REQUEST_DELAY} seconds")

    summary = ImportSummary()
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    with httpx.Client(headers=headers, timeout=30) as http, SessionLocal() as session:
        client = RateLimitedClient(http, request_delay)
        with catalog_import_run(session, PROVIDER) as run:
            summary.run_id = run.id
            for page in range(pages):
                payload = client.search(query=query, offset=page * 100)
                results = payload.get("release-groups", [])
                if not isinstance(results, list) or not results:
                    break
                for item in results:
                    if not isinstance(item, dict):
                        summary.skipped += 1
                        run.skipped += 1
                        continue
                    try:
                        outcome = _upsert_release_group(session, item, genre.strip() or "Album")
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
                    except (KeyError, TypeError, ValueError):
                        session.rollback()
                        summary.skipped += 1
                        run.skipped += 1
                if len(results) < 100:
                    break
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--query", default="primarytype:album", help="MusicBrainz core release-group search query.")
    parser.add_argument("--pages", type=int, default=1, help="Number of 100-item result pages (1–10).")
    parser.add_argument("--genre", default="Album", help="Tastera-owned local genre label; does not import MusicBrainz tags.")
    parser.add_argument("--request-delay", type=float, default=MIN_REQUEST_DELAY, help="Seconds between API calls; minimum 1.1 to respect the service limit.")
    args = parser.parse_args()
    try:
        summary = import_albums(
            query=args.query,
            pages=args.pages,
            genre=args.genre,
            request_delay=args.request_delay,
        )
    except (httpx.HTTPError, ValueError) as error:
        parser.error(str(error))
    print(
        f"MusicBrainz import run {summary.run_id} complete: {summary.added} added, "
        f"{summary.updated} updated, {summary.skipped} skipped."
    )


if __name__ == "__main__":
    main()
