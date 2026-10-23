"""Import album release-group metadata, community genres, and cover artwork.

The importer uses the core release-group fields (CC0), plus mapped community
genre tags (CC BY-NC-SA 3.0). It sends an identifying User-Agent, enforces
MusicBrainz's one-request-per-second API limit, and links to externally hosted
Cover Art Archive thumbnails without copying them into Tastera.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import math
import time
from dataclasses import dataclass
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.account import RecommendationFeedbackRecord, SavedMediaRecord
from app.models.catalog import Genre, MediaGenre, MediaIdentifier, MediaItemRecord
from app.services.import_tracking import catalog_import_run


API_URL = "https://musicbrainz.org/ws/2/release-group"
PROVIDER = "musicbrainz-release-group"
SOURCE = "MusicBrainz core (CC0)"
SOURCE_WITH_GENRES = "MusicBrainz CC0 + supplementary genres CC BY-NC-SA 3.0"
MIN_REQUEST_DELAY = 1.1
USER_AGENT = "Tastera/0.1 (https://soumadip-tastera.vercel.app/)"
CAA_FRONT_URL = "https://coverartarchive.org/release-group/{}/front-500"
POPULAR_GENRE_TAGS = (
    "rock", "pop", "hip hop", "jazz", "electronic", "rhythm and blues",
    "country", "metal", "soul", "classical", "folk", "reggae", "punk",
    "disco", "funk", "latin", "ambient", "soundtrack",
)

GENRE_TAGS = {
    "alternative rock": "Alternative Rock",
    "alternative pop": "Alternative Pop",
    "ambient": "Ambient",
    "blues": "Blues",
    "classical": "Classical",
    "country": "Country",
    "dance": "Dance",
    "disco": "Disco",
    "drum and bass": "Drum and Bass",
    "electronic": "Electronic",
    "folk": "Folk",
    "funk": "Funk",
    "grunge": "Grunge",
    "hard rock": "Hard Rock",
    "heavy metal": "Heavy Metal",
    "hip hop": "Hip Hop",
    "house": "House",
    "indie pop": "Indie Pop",
    "indie rock": "Indie Rock",
    "jazz": "Jazz",
    "metal": "Metal",
    "pop": "Pop",
    "pop rock": "Pop Rock",
    "punk": "Punk",
    "punk rock": "Punk Rock",
    "rap": "Rap",
    "reggae": "Reggae",
    "rhythm and blues": "R&B",
    "r&b": "R&B",
    "rock": "Rock",
    "singer-songwriter": "Singer-Songwriter",
    "ska": "Ska",
    "soul": "Soul",
    "soundtrack": "Soundtrack",
    "synth-pop": "Synth-Pop",
    "techno": "Techno",
    "trance": "Trance",
    "world": "World",
}


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

    def search(self, *, query: str, offset: int, limit: int = 100) -> dict[str, Any]:
        wait = self.delay - (time.monotonic() - self.last_request)
        if wait > 0:
            time.sleep(wait)
        for attempt in range(4):
            self.last_request = time.monotonic()
            response = self.client.get(
                API_URL,
                params={
                    "query": query,
                    "fmt": "json",
                    "limit": limit,
                    "offset": offset,
                    "inc": "genres",
                },
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


def _community_tags(item: dict[str, Any]) -> Any:
    """Support both legacy `tags` and newer `genres` response field names."""
    return item.get("tags") or item.get("genres", [])


def _community_popularity(item: dict[str, Any]) -> int:
    """Sum positive MusicBrainz tag votes as a rough discovery/popularity signal."""
    tags = _community_tags(item)
    if not isinstance(tags, list):
        return 0
    return sum(
        tag.get("count", 0)
        for tag in tags
        if isinstance(tag, dict)
        and isinstance(tag.get("count"), int)
        and tag["count"] > 0
    )


def _cover_artwork(client: httpx.Client, release_group_id: str) -> str | None:
    """Return a confirmed CAA front-cover URL, or None if there is no cover.

    CAA documents a 307 from its front-cover endpoint as confirmation that a
    front image exists. Keep its stable URL rather than following the redirect
    during import: the target is hosted by Internet Archive and can be
    temporarily unavailable even when CAA has valid artwork metadata.
    """
    url = CAA_FRONT_URL.format(release_group_id)
    for attempt in range(3):
        response = client.get(url, follow_redirects=False)
        if response.status_code == 404:
            return None
        if response.status_code == 307:
            return url
        if response.status_code == 429 or response.status_code >= 500:
            if attempt < 2:
                time.sleep(1.0 * (attempt + 1))
                continue
        response.raise_for_status()
    return None


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


def _community_genre_names(tags: Any) -> list[str]:
    """Pick positive-vote MusicBrainz community tags from a genre allowlist."""
    ranked: list[tuple[int, str]] = []
    if isinstance(tags, list):
        for tag in tags:
            if not isinstance(tag, dict):
                continue
            name = tag.get("name")
            count = tag.get("count", 0)
            if not isinstance(name, str) or not isinstance(count, int) or count <= 0:
                continue
            canonical = GENRE_TAGS.get(name.strip().casefold())
            if canonical and canonical not in {value for _, value in ranked}:
                ranked.append((count, canonical))
    ranked.sort(key=lambda entry: (-entry[0], entry[1].casefold()))
    return [name for _, name in ranked[:3]]


def _genre_names(tags: Any, fallback: str) -> list[str]:
    return _community_genre_names(tags) or [fallback.strip() or "Unclassified"]


def _upsert_release_group(
    session: Session,
    item: dict[str, Any],
    genre_names: list[str],
    artwork_url: str,
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
    genre_names = list(dict.fromkeys(name.strip() for name in genre_names if name.strip()))
    if not genre_names:
        genre_names = ["Unclassified"]
    genre_rows = [_get_genre(session, name) for name in genre_names]
    date = item.get("first-release-date")
    secondary_types = item.get("secondary-types", [])
    classifications = (
        [value for value in secondary_types if isinstance(value, str) and value.strip()]
        if isinstance(secondary_types, list)
        else []
    )
    details = ["MusicBrainz core metadata"]
    tags = _community_tags(item)
    supplementary_genres = _community_genre_names(tags)
    community_tags_used = isinstance(tags, list) and any(
        isinstance(tag, dict)
        and isinstance(tag.get("count"), int)
        and tag["count"] > 0
        for tag in tags
    )
    if supplementary_genres:
        details.append("genre tags from MusicBrainz supplementary data (CC BY-NC-SA 3.0)")
    elif community_tags_used:
        details.append("community tag counts used for ranking (CC BY-NC-SA 3.0)")
    if classifications:
        details.append(f"Release type: {', '.join(classifications)}")
    if isinstance(date, str) and date.strip():
        details.append(f"First release date: {date.strip()}")
    description = ". ".join(details) + "."
    connection = "Imported from MusicBrainz; album artwork is linked from the Cover Art Archive."
    source = SOURCE_WITH_GENRES if community_tags_used else SOURCE
    popularity_score = math.log1p(_community_popularity(item))

    if media is None:
        media = MediaItemRecord(
            id=f"musicbrainz-rg-{external_id}"[:100],
            title=title,
            creator=creator,
            category="Music",
            primary_genre=genre_names[0],
            description=description,
            artwork_url=artwork_url,
            connection=connection,
            source=source,
            popularity_score=popularity_score,
            identifiers=[MediaIdentifier(provider=PROVIDER, external_id=external_id)],
            genre_links=[MediaGenre(genre=genre) for genre in genre_rows],
        )
        session.add(media)
        return "added"

    media.title = title
    media.creator = creator
    media.category = "Music"
    media.primary_genre = genre_names[0]
    media.description = description
    media.artwork_url = artwork_url
    media.connection = connection
    media.source = source
    media.popularity_score = popularity_score
    media.genre_links.clear()
    media.genre_links.extend(MediaGenre(genre=genre) for genre in genre_rows)
    return "updated"


def import_albums(
    *,
    query: str | None = None,
    limit: int = 500,
    genre: str = "Unclassified",
    request_delay: float = MIN_REQUEST_DELAY,
    prune_unselected: bool = False,
) -> ImportSummary:
    if query is not None and not query.strip():
        raise ValueError("query cannot be blank")
    if limit < 1 or limit > 500:
        raise ValueError("limit must be between 1 and 500")
    if len(genre) > 100:
        raise ValueError("genre must be 100 characters or fewer")
    if request_delay < MIN_REQUEST_DELAY:
        raise ValueError(f"request-delay cannot be less than {MIN_REQUEST_DELAY} seconds")

    summary = ImportSummary()
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    with httpx.Client(headers=headers, timeout=30) as http, SessionLocal() as session:
        client = RateLimitedClient(http, request_delay)
        queries = [query] if query else [
            f'primarytype:album AND tag:"{tag}"' for tag in POPULAR_GENRE_TAGS
        ]
        candidates: dict[str, dict[str, Any]] = {}
        for search_query in queries:
            payload = client.search(query=search_query, offset=0, limit=100)
            results = payload.get("release-groups", [])
            if not isinstance(results, list):
                continue
            for item in results:
                if not isinstance(item, dict):
                    continue
                external_id = item.get("id")
                if not isinstance(external_id, str):
                    continue
                item["_tastera_popularity"] = _community_popularity(item)
                existing = candidates.get(external_id)
                if existing is None or item["_tastera_popularity"] > existing["_tastera_popularity"]:
                    candidates[external_id] = item

        ranked = sorted(
            candidates.values(),
            key=lambda item: (
                -item["_tastera_popularity"],
                str(item.get("title", "")).casefold(),
                str(item.get("id", "")),
            ),
        )
        # CAA confirms whether a usable front cover exists; only verified items
        # can enter the refreshed music catalog. CAA documents this endpoint as
        # returning 404 when the community has not selected front artwork.
        artwork_by_id: dict[str, str] = {}
        with ThreadPoolExecutor(max_workers=12) as pool:
            checks = pool.map(
                lambda item: (item["id"], _cover_artwork(http, item["id"])),
                ranked,
            )
            for external_id, artwork in checks:
                if artwork:
                    artwork_by_id[external_id] = artwork
                    if len(artwork_by_id) >= limit:
                        break
        selected = [
            item for item in ranked if item.get("id") in artwork_by_id
        ][:limit]

        with catalog_import_run(session, PROVIDER) as run:
            summary.run_id = run.id
            selected_ids: set[str] = set()
            for item in selected:
                try:
                    external_id = str(item["id"])
                    outcome = _upsert_release_group(
                        session,
                        item,
                        _genre_names(_community_tags(item), genre),
                        artwork_by_id[external_id],
                    )
                    if outcome == "skipped":
                        summary.skipped += 1
                        run.skipped += 1
                        continue
                    media_id = f"musicbrainz-rg-{external_id}"[:100]
                    selected_ids.add(media_id)
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
            not_selected_count = max(0, len(candidates) - len(selected))
            summary.skipped += not_selected_count
            run.skipped += not_selected_count
            if prune_unselected and selected_ids:
                saved_ids = select(SavedMediaRecord.media_item_id)
                feedback_ids = select(RecommendationFeedbackRecord.media_item_id)
                unselected = session.scalars(
                    select(MediaItemRecord).where(
                        MediaItemRecord.id.like("musicbrainz-rg-%"),
                        MediaItemRecord.source.in_((SOURCE, SOURCE_WITH_GENRES)),
                        MediaItemRecord.id.not_in(selected_ids),
                        MediaItemRecord.id.not_in(saved_ids),
                        MediaItemRecord.id.not_in(feedback_ids),
                    )
                ).all()
                for item in unselected:
                    session.delete(item)
                session.commit()
        print(
            f"Found {len(candidates)} unique genre-tagged albums; "
            f"confirmed front covers for {len(artwork_by_id)}; "
            f"selected {len(selected)} popular albums with covers."
        )
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--query", help="Optional MusicBrainz release-group query override. By default, ranked genre searches are combined.")
    parser.add_argument("--limit", type=int, default=500, help="Maximum popular albums with confirmed Cover Art Archive front covers (1–500).")
    parser.add_argument("--genre", default="Unclassified", help="Tastera-owned genre label for this import. MusicBrainz core metadata does not supply genres; use a genre only for a curated query whose results have been checked.")
    parser.add_argument("--request-delay", type=float, default=MIN_REQUEST_DELAY, help="Seconds between API calls; minimum 1.1 to respect the service limit.")
    parser.add_argument("--prune-unselected", action="store_true", help="Remove older MusicBrainz imports outside the selected covered set, preserving saved or feedback-rated items.")
    args = parser.parse_args()
    try:
        summary = import_albums(
            query=args.query,
            limit=args.limit,
            genre=args.genre,
            request_delay=args.request_delay,
            prune_unselected=args.prune_unselected,
        )
    except (httpx.HTTPError, ValueError) as error:
        parser.error(str(error))
    print(
        f"MusicBrainz import run {summary.run_id} complete: {summary.added} added, "
        f"{summary.updated} updated, {summary.skipped} skipped."
    )


if __name__ == "__main__":
    main()
