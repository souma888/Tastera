"""Import popular Indian songs with confirmed album covers from MusicBrainz/CAA.

Track metadata comes from MusicBrainz; artwork is linked from Cover Art Archive.
No audio files or image files are copied into Tastera.
"""

from __future__ import annotations

import argparse
import math
import time
from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any

import httpx
from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.catalog import MediaGenre, MediaIdentifier, MediaItemRecord, MediaRelationshipRecord
from app.services.import_tracking import catalog_import_run
from app.import_musicbrainz import (
    API_URL,
    MIN_REQUEST_DELAY,
    SOURCE_WITH_GENRES,
    USER_AGENT,
    _artist_credit,
    _community_genre_names,
    _community_popularity,
    _community_tags,
    _cover_artwork,
    _get_genre,
    _upsert_release_group,
)


SONG_PROVIDER = "musicbrainz-recording"
SONG_SOURCE = "MusicBrainz core (CC0) + Cover Art Archive"
PROVIDER = "musicbrainz-indian-songs"
LANGUAGE_TAGS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Hindi", ("bollywood", "filmi", "hindi")),
    ("Punjabi", ("punjabi", "bhangra")),
    ("Bengali", ("bengali", "bangla")),
    ("Tamil", ("tamil", "kollywood")),
    ("Telugu", ("telugu", "tollywood")),
    ("Malayalam", ("malayalam", "mollywood")),
    ("Kannada", ("kannada", "sandalwood")),
)


@dataclass
class ImportSummary:
    added: int = 0
    updated: int = 0
    skipped: int = 0
    run_id: int | None = None


class RecordingSearch:
    """MusicBrainz search client paced at the public API's one request/second limit."""

    def __init__(self, client: httpx.Client, delay: float) -> None:
        self.client = client
        self.delay = max(delay, MIN_REQUEST_DELAY)
        self.last_request = 0.0

    def search(self, query: str, offset: int) -> dict[str, Any]:
        wait = self.delay - (time.monotonic() - self.last_request)
        if wait > 0:
            time.sleep(wait)
        for attempt in range(4):
            self.last_request = time.monotonic()
            response = self.client.get(
                API_URL.replace("release-group", "recording"),
                params={"query": query, "fmt": "json", "limit": 100, "offset": offset, "inc": "releases+genres"},
            )
            if response.status_code in (429, 503) or response.status_code >= 500:
                if attempt == 3:
                    response.raise_for_status()
                retry_after = response.headers.get("Retry-After")
                try:
                    delay = float(retry_after) if retry_after else self.delay * (2**attempt)
                except ValueError:
                    delay = self.delay * (2**attempt)
                time.sleep(max(self.delay, delay))
                continue
            response.raise_for_status()
            payload = response.json()
            return payload if isinstance(payload, dict) else {}
        return {}


def _recording_pages(search: RecordingSearch, query: str, needed: int) -> Iterator[dict[str, Any]]:
    """Yield ranked query results with bounded pagination."""
    if needed <= 0:
        return
    # Gather an oversample because some recordings have no album association or cover.
    page_count = min(20, max(1, math.ceil(needed * 2.5 / 100)))
    for page in range(page_count):
        payload = search.search(query, page * 100)
        recordings = payload.get("recordings", [])
        if not isinstance(recordings, list) or not recordings:
            break
        for item in recordings:
            if isinstance(item, dict):
                yield item
        if page * 100 + len(recordings) >= int(payload.get("count", 0)):
            break


def _album_options(recording: dict[str, Any]) -> list[dict[str, Any]]:
    releases = recording.get("releases", [])
    if not isinstance(releases, list):
        return []
    candidates = [
        release for release in releases
        if isinstance(release, dict)
        and isinstance(release.get("release-group"), dict)
        and isinstance(release["release-group"].get("id"), str)
    ]
    candidates.sort(
        key=lambda release: (
            0 if release.get("status") == "Official" else 1,
            0 if release.get("release-group", {}).get("primary-type") in ("Album", "Soundtrack") else 1,
            1 if "Compilation" in release.get("release-group", {}).get("secondary-types", []) else 0,
            str(release.get("title", "")).casefold(),
        )
    )
    return candidates


def _track_record(
    session: Any,
    recording: dict[str, Any],
    release: dict[str, Any],
    cover_url: str,
    language: str,
) -> tuple[str, str] | None:
    recording_id = recording.get("id")
    title = recording.get("title")
    album = release.get("title")
    release_group = release.get("release-group", {})
    group_id = release_group.get("id")
    creator = _artist_credit(recording.get("artist-credit"))
    if not all(isinstance(value, str) and value.strip() for value in (recording_id, title, album, group_id, creator)):
        return None
    title, album, creator = title.strip(), album.strip(), creator.strip()[:500]
    if len(title) > 500 or len(album) > 500:
        return None

    tags = _community_tags(recording)
    genres = _community_genre_names(tags) or [f"{language} Music"]
    popularity = math.log1p(_community_popularity(recording))
    first_release = recording.get("first-release-date")
    album_group = {
        "id": group_id,
        "title": album,
        "artist-credit": recording.get("artist-credit", []),
        "first-release-date": first_release,
        "secondary-types": release_group.get("secondary-types", []),
        "genres": tags,
        "tags": tags,
    }
    # Keep a distinct album entry and a relation from every track to its album.
    album_outcome = _upsert_release_group(session, album_group, genres, cover_url)
    album_id = f"musicbrainz-rg-{group_id}"[:100]
    session.flush()
    album_record = session.get(MediaItemRecord, album_id)
    if album_record is not None:
        album_record.language = language

    identifier = session.scalar(
        select(MediaIdentifier).where(
            MediaIdentifier.provider == SONG_PROVIDER,
            MediaIdentifier.external_id == recording_id,
        )
    )
    song = session.get(MediaItemRecord, identifier.media_item_id) if identifier else None
    description = f"Song from the album {album}. Language: {language}."
    if isinstance(first_release, str) and first_release:
        description += f" First released: {first_release}."
    source = SOURCE_WITH_GENRES if _community_tags(recording) else SONG_SOURCE
    if song is None:
        song = MediaItemRecord(
            id=f"musicbrainz-song-{recording_id}"[:100],
            title=title,
            creator=creator,
            category="Music",
            language=language,
            primary_genre=genres[0],
            description=description,
            artwork_url=cover_url,
            connection=f"Track from {album}; cover linked from the Cover Art Archive.",
            source=source,
            popularity_score=popularity,
            identifiers=[MediaIdentifier(provider=SONG_PROVIDER, external_id=recording_id)],
            genre_links=[MediaGenre(genre=_get_genre(session, genre)) for genre in genres],
        )
        session.add(song)
        outcome = "added"
    else:
        song.title, song.creator, song.category, song.language = title, creator, "Music", language
        song.primary_genre, song.description, song.artwork_url = genres[0], description, cover_url
        song.connection, song.source, song.popularity_score = f"Track from {album}; cover linked from the Cover Art Archive.", source, popularity
        song.genre_links.clear()
        song.genre_links.extend(MediaGenre(genre=_get_genre(session, genre)) for genre in genres)
        outcome = "updated"

    if album_outcome not in ("added", "updated"):
        return None
    relation = session.scalar(
        select(MediaRelationshipRecord).where(
            MediaRelationshipRecord.source_media_id == song.id,
            MediaRelationshipRecord.target_media_id == album_id,
            MediaRelationshipRecord.relationship_type == "track-on-album",
        )
    )
    if relation is None:
        session.add(MediaRelationshipRecord(
            source_media_id=song.id,
            target_media_id=album_id,
            relationship_type="track-on-album",
            provenance="MusicBrainz recording and release group",
            source_url=f"https://musicbrainz.org/release-group/{group_id}",
        ))
    return outcome, album_id


def import_indian_songs(*, total: int = 1000, request_delay: float = MIN_REQUEST_DELAY) -> ImportSummary:
    if not 1 <= total <= 3000:
        raise ValueError("total must be between 1 and 3000")
    if request_delay < MIN_REQUEST_DELAY:
        raise ValueError(f"request-delay cannot be less than {MIN_REQUEST_DELAY} seconds")

    hindi = round(total * 0.7)
    other = total - hindi
    base, remainder = divmod(other, len(LANGUAGE_TAGS) - 1)
    targets = [hindi, *[base + (index < remainder) for index in range(len(LANGUAGE_TAGS) - 1)]]
    summary = ImportSummary()
    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    with httpx.Client(headers=headers, timeout=30) as http, SessionLocal() as session:
        search = RecordingSearch(http, request_delay)
        with catalog_import_run(session, PROVIDER) as run:
            summary.run_id = run.id
            cover_cache: dict[str, str | None] = {}
            for (language, tags), target in zip(LANGUAGE_TAGS, targets):
                candidates: dict[str, dict[str, Any]] = {}
                for tag in tags:
                    query = f'tag:"{tag}"'
                    for recording in _recording_pages(search, query, target):
                        recording_id = recording.get("id")
                        if isinstance(recording_id, str) and recording_id not in candidates:
                            recording["_language"] = language
                            candidates[recording_id] = recording
                        if len(candidates) >= target * 3:
                            break
                    if len(candidates) >= target * 3:
                        break

                ranked = sorted(
                    candidates.values(),
                    key=lambda item: (
                        -_community_popularity(item),
                        -int(item.get("score", 0) or 0),
                        str(item.get("title", "")).casefold(),
                    ),
                )
                eligible: list[tuple[dict[str, Any], dict[str, Any], str]] = []
                for recording in ranked:
                    if len(eligible) >= target:
                        break
                    release_with_cover: tuple[dict[str, Any], str] | None = None
                    for release in _album_options(recording):
                        group_id = release["release-group"]["id"]
                        if group_id not in cover_cache:
                            cover_cache[group_id] = _cover_artwork(http, group_id)
                        if cover_cache[group_id]:
                            release_with_cover = (release, cover_cache[group_id])
                            break
                    if release_with_cover is None:
                        summary.skipped += 1
                        run.skipped += 1
                        continue
                    release, cover_url = release_with_cover
                    eligible.append((recording, release, cover_url))

                added_here = 0
                for recording, release, cover_url in eligible:
                    try:
                        result = _track_record(session, recording, release, cover_url, language)
                        if result is None:
                            summary.skipped += 1
                            run.skipped += 1
                            continue
                        outcome, _ = result
                        if outcome == "added":
                            summary.added += 1
                            run.added += 1
                        else:
                            summary.updated += 1
                            run.updated += 1
                        session.commit()
                        added_here += 1
                    except (KeyError, TypeError, ValueError):
                        session.rollback()
                        summary.skipped += 1
                        run.skipped += 1
                print(f"{language}: {added_here}/{target} tracks imported with covers")

    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--count", type=int, default=1000, help="Target track count (1-3000; default 1000).")
    parser.add_argument("--request-delay", type=float, default=MIN_REQUEST_DELAY, help="Delay between MusicBrainz API requests (minimum 1.1 seconds).")
    args = parser.parse_args()
    try:
        summary = import_indian_songs(total=args.count, request_delay=args.request_delay)
    except (httpx.HTTPError, ValueError) as error:
        parser.error(str(error))
    print(f"Song import run {summary.run_id} complete: {summary.added} added, {summary.updated} updated, {summary.skipped} skipped.")


if __name__ == "__main__":
    main()
