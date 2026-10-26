"""Import popular movie metadata from TMDb into the TASTERA catalog.

Requires ``TMDB_READ_ACCESS_TOKEN``. Re-running this command updates records
matched by their TMDb movie ID instead of inserting duplicates.
"""

from __future__ import annotations

import argparse
import math
import os
import time
from dataclasses import dataclass
from typing import Any

import httpx
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.catalog import Genre, MediaGenre, MediaIdentifier, MediaItemRecord
from app.services.import_tracking import catalog_import_run


TMDB_API = "https://api.themoviedb.org/3"
TMDB_IMAGE = "https://image.tmdb.org/t/p/w500"
PROVIDER = "tmdb-movie"
WATCH_PROVIDER_REGION = "US"
INDIAN_MOVIE_LANGUAGES = ("hi", "ta", "te", "ml", "kn")


@dataclass
class ImportSummary:
    added: int = 0
    updated: int = 0
    skipped: int = 0
    run_id: int | None = None


def _request(client: httpx.Client, path: str, params: dict[str, Any]) -> dict[str, Any]:
    """GET a TMDb endpoint with bounded retries for transient responses."""

    for attempt in range(4):
        response = client.get(f"{TMDB_API}{path}", params=params)
        if response.status_code == 429 or response.status_code >= 500:
            if attempt == 3:
                response.raise_for_status()
            retry_after = response.headers.get("Retry-After")
            delay = min(float(retry_after), 30) if retry_after else 2**attempt
            time.sleep(delay)
            continue
        response.raise_for_status()
        return response.json()
    raise RuntimeError(f"TMDb request failed after retries: {path}")


def _director(credits: dict[str, Any]) -> str:
    directors = [
        person.get("name", "").strip()
        for person in credits.get("crew", [])
        if person.get("job") == "Director" and person.get("name")
    ]
    if directors:
        return ", ".join(dict.fromkeys(directors))
    cast = [person.get("name", "").strip() for person in credits.get("cast", [])[:3]]
    return ", ".join(name for name in cast if name) or "Unknown filmmaker"


def _genre_for(
    session: Session,
    names: list[str],
    genre_cache: dict[str, Genre],
) -> tuple[str, list[Genre]]:
    selected: list[Genre] = []
    for name in names:
        genre = genre_cache.get(name)
        if genre is None:
            genre = session.scalar(select(Genre).where(Genre.name == name))
            if genre is None:
                genre = Genre(name=name)
                session.add(genre)
                session.flush()
            genre_cache[name] = genre
        selected.append(genre)
    if not selected:
        selected = [_genre_for(session, ["Uncategorized"], genre_cache)[1][0]]
    return selected[0].name, selected


def _upsert_movie(
    session: Session,
    movie: dict[str, Any],
    genre_names: dict[int, str],
    genre_cache: dict[str, Genre],
    client: httpx.Client,
    watch_region: str = WATCH_PROVIDER_REGION,
) -> str:
    external_id = str(movie["id"])
    identifier = session.scalar(
        select(MediaIdentifier).where(
            MediaIdentifier.provider == PROVIDER,
            MediaIdentifier.external_id == external_id,
        )
    )
    record = session.get(MediaItemRecord, identifier.media_item_id) if identifier else None

    credits = _request(client, f"/movie/{external_id}/credits", {})
    provider_data = _request(client, f"/movie/{external_id}/watch/providers", {}).get("results", {}).get(watch_region.upper(), {})
    creator = _director(credits)
    title = (movie.get("title") or movie.get("original_title") or "Untitled movie").strip()
    if record is None:
        # Reuse an editorial seed when both its normalized title and creator
        # match, while keeping the provider ID as a separate identifier.
        record = session.scalar(
            select(MediaItemRecord).where(
                MediaItemRecord.category == "Movies",
                func.lower(MediaItemRecord.title) == title.lower(),
                func.lower(MediaItemRecord.creator) == creator.lower(),
            )
        )
        if record is not None:
            record.identifiers.append(
                MediaIdentifier(provider=PROVIDER, external_id=external_id)
            )

    genre_ids = movie.get("genre_ids", [])
    names = [genre_names[item] for item in genre_ids if item in genre_names]
    primary_genre, genres = _genre_for(session, names, genre_cache)

    poster_path = movie.get("poster_path")
    artwork = f"{TMDB_IMAGE}{poster_path}" if poster_path else "https://placehold.co/500x750/17121e/eee?text=No+Poster"
    raw_popularity = movie.get("popularity", 0)
    popularity_score = math.log1p(raw_popularity) if isinstance(raw_popularity, (int, float)) and raw_popularity > 0 else 0.0

    if record is None:
        record = MediaItemRecord(
            id=f"tmdb-movie-{external_id}",
            title=title,
            creator=creator,
            category="Movies",
            primary_genre=primary_genre,
            language=movie.get("original_language"),
            description=movie.get("overview") or None,
            artwork_url=artwork,
            watch_url=provider_data.get("link"),
            provider_region=watch_region.upper() if provider_data.get("link") else None,
            connection="Imported from TMDb; editorial connections have not been reviewed.",
            source="TMDb",
            popularity_score=popularity_score,
            identifiers=[MediaIdentifier(provider=PROVIDER, external_id=external_id)],
            genre_links=[MediaGenre(genre=genre) for genre in genres],
        )
        session.add(record)
        return "added"

    record.title = title
    record.creator = creator
    record.category = "Movies"
    record.primary_genre = primary_genre
    record.language = movie.get("original_language")
    record.description = movie.get("overview") or None
    record.artwork_url = artwork
    record.watch_url = provider_data.get("link")
    record.provider_region = watch_region.upper() if provider_data.get("link") else None
    record.source = "TMDb"
    record.popularity_score = popularity_score
    record.genre_links.clear()
    record.genre_links.extend(MediaGenre(genre=genre) for genre in genres)
    return "updated"


def import_popular_movies(
    *,
    pages: int = 1,
    language: str = "en-US",
    request_delay: float = 0.25,
    watch_region: str = WATCH_PROVIDER_REGION,
) -> ImportSummary:
    """Import popular movies, fetching directors and poster metadata."""

    token = os.getenv("TMDB_READ_ACCESS_TOKEN")
    if not token:
        raise RuntimeError(
            "Set TMDB_READ_ACCESS_TOKEN to a TMDb API Read Access Token before importing."
        )
    if pages < 1 or pages > 500:
        raise ValueError("pages must be between 1 and 500")

    summary = ImportSummary()
    with httpx.Client(
        headers={"Authorization": f"Bearer {token}", "accept": "application/json"},
        timeout=30,
    ) as client, SessionLocal() as session:
        with catalog_import_run(session, PROVIDER) as run:
            summary.run_id = run.id
            genres_response = _request(client, "/genre/movie/list", {"language": language})
            genre_names = {int(genre["id"]): genre["name"] for genre in genres_response["genres"]}
            genre_cache: dict[str, Genre] = {}

            for page in range(1, pages + 1):
                results = _request(
                    client,
                    "/movie/popular",
                    {"language": language, "page": page},
                ).get("results", [])
                for movie in results:
                    external_id = str(movie.get("id", ""))
                    if not external_id.isdigit() or not (movie.get("title") or movie.get("original_title")):
                        summary.skipped += 1
                        run.skipped += 1
                        continue
                    try:
                        outcome = _upsert_movie(
                            session, movie, genre_names, genre_cache, client, watch_region
                        )
                        if outcome == "added":
                            summary.added += 1
                            run.added += 1
                        else:
                            summary.updated += 1
                            run.updated += 1
                        session.commit()
                    except (httpx.HTTPError, KeyError, ValueError):
                        session.rollback()
                        summary.skipped += 1
                        run.skipped += 1
                    if request_delay:
                        time.sleep(request_delay)

    return summary


def import_indian_movies(
    *,
    total: int = 1000,
    request_delay: float = 0.25,
    watch_region: str = "IN",
) -> ImportSummary:
    """Import highly rated Indian films, weighted toward Hindi cinema.

    The default target reserves about 60% for Hindi films and splits the rest
    evenly across Tamil, Telugu, Malayalam, and Kannada films. TMDb's vote
    count ordering favors established, widely rated titles over obscure entries.
    """
    token = os.getenv("TMDB_READ_ACCESS_TOKEN")
    if not token:
        raise RuntimeError(
            "Set TMDB_READ_ACCESS_TOKEN to a TMDb API Read Access Token before importing."
        )
    if total < 1 or total > 5000:
        raise ValueError("total must be between 1 and 5000")

    hindi_target = round(total * 0.6)
    remaining = total - hindi_target
    regional_targets = [remaining // 4] * 4
    for index in range(remaining % 4):
        regional_targets[index] += 1
    language_targets = dict(zip(INDIAN_MOVIE_LANGUAGES, [hindi_target, *regional_targets]))

    summary = ImportSummary()
    with httpx.Client(
        headers={"Authorization": f"Bearer {token}", "accept": "application/json"},
        timeout=30,
    ) as client, SessionLocal() as session:
        with catalog_import_run(session, "tmdb-indian-movie") as run:
            genres_response = _request(client, "/genre/movie/list", {"language": "en-US"})
            genre_names = {int(genre["id"]): genre["name"] for genre in genres_response["genres"]}
            genre_cache: dict[str, Genre] = {}

            for original_language, target in language_targets.items():
                imported_candidates = 0
                page = 1
                while imported_candidates < target:
                    result = _request(
                        client,
                        "/discover/movie",
                        {
                            "language": "en-US",
                            "with_original_language": original_language,
                            "with_origin_country": "IN",
                            "vote_count.gte": 50,
                            "sort_by": "vote_count.desc",
                            "include_adult": "false",
                            "page": page,
                        },
                    )
                    movies = result.get("results", [])
                    if not movies:
                        break

                    for movie in movies:
                        external_id = str(movie.get("id", ""))
                        if not external_id.isdigit() or not (movie.get("title") or movie.get("original_title")):
                            summary.skipped += 1
                            run.skipped += 1
                            continue
                        try:
                            outcome = _upsert_movie(
                                session, movie, genre_names, genre_cache, client, watch_region
                            )
                            if outcome == "added":
                                summary.added += 1
                                run.added += 1
                            else:
                                summary.updated += 1
                                run.updated += 1
                            session.commit()
                            imported_candidates += 1
                        except (httpx.HTTPError, KeyError, ValueError):
                            session.rollback()
                            summary.skipped += 1
                            run.skipped += 1
                        if request_delay:
                            time.sleep(request_delay)

                    if page >= int(result.get("total_pages", page)):
                        break
                    page += 1

    return summary


def import_popular_tv(*, pages: int = 1, language: str = "en-US", request_delay: float = 0.25, watch_region: str = WATCH_PROVIDER_REGION) -> ImportSummary:
    """Import popular TV metadata and region-scoped TMDb watch links."""
    token = os.getenv("TMDB_READ_ACCESS_TOKEN")
    if not token:
        raise RuntimeError("Set TMDB_READ_ACCESS_TOKEN to import TMDb TV metadata.")
    if pages < 1 or pages > 500:
        raise ValueError("pages must be between 1 and 500")
    summary = ImportSummary()
    provider = "tmdb-tv"
    with httpx.Client(headers={"Authorization": f"Bearer {token}", "accept": "application/json"}, timeout=30) as client, SessionLocal() as session:
        with catalog_import_run(session, provider) as run:
            summary.run_id = run.id
            genre_response = _request(client, "/genre/tv/list", {"language": language})
            genre_names = {int(row["id"]): row["name"] for row in genre_response.get("genres", [])}
            genre_cache: dict[str, Genre] = {}
            for page in range(1, pages + 1):
                shows = _request(client, "/tv/popular", {"language": language, "page": page}).get("results", [])
                for show in shows:
                    external_id = str(show.get("id", ""))
                    title = (show.get("name") or show.get("original_name") or "").strip()
                    if not external_id.isdigit() or not title:
                        summary.skipped += 1; run.skipped += 1
                        continue
                    try:
                        creators = [person.get("name", "").strip() for person in show.get("created_by", []) if person.get("name")]
                        if not creators:
                            credits = _request(client, f"/tv/{external_id}/aggregate_credits", {}).get("crew", [])
                            creators = [person.get("name", "").strip() for person in credits if person.get("job") == "Executive Producer" and person.get("name")][:3]
                        creator = ", ".join(dict.fromkeys(creators)) or "Unknown creator"
                        identifier = session.scalar(select(MediaIdentifier).where(MediaIdentifier.provider == provider, MediaIdentifier.external_id == external_id))
                        record = session.get(MediaItemRecord, identifier.media_item_id) if identifier else None
                        if record is None:
                            record = MediaItemRecord(id=f"tmdb-tv-{external_id}", title=title, creator=creator, category="TV", primary_genre="Genre not provided", connection="Imported from TMDb; relationship links have not been reviewed.", source="TMDb", identifiers=[MediaIdentifier(provider=provider, external_id=external_id)])
                            session.add(record)
                        names = [genre_names[value] for value in show.get("genre_ids", []) if value in genre_names]
                        primary, genres = _genre_for(session, names, genre_cache)
                        image_path = show.get("poster_path")
                        region = watch_region.upper()
                        providers = _request(client, f"/tv/{external_id}/watch/providers", {}).get("results", {}).get(region, {})
                        record.title, record.creator, record.category = title, creator, "TV"
                        record.language = show.get("original_language")
                        record.primary_genre = primary
                        record.description = show.get("overview") or None
                        record.artwork_url = f"{TMDB_IMAGE}{image_path}" if image_path else None
                        record.watch_url = providers.get("link")
                        record.provider_region = region if record.watch_url else None
                        record.popularity_score = math.log1p(show.get("popularity", 0)) if show.get("popularity", 0) > 0 else 0
                        record.source = "TMDb"
                        record.genre_links.clear(); record.genre_links.extend(MediaGenre(genre=genre) for genre in genres)
                        if identifier is None and record.id != f"tmdb-tv-{external_id}":
                            record.identifiers.append(MediaIdentifier(provider=provider, external_id=external_id))
                        session.commit()
                        if record.id == f"tmdb-tv-{external_id}" and identifier is None: summary.added += 1; run.added += 1
                        else: summary.updated += 1; run.updated += 1
                    except (httpx.HTTPError, KeyError, ValueError, TypeError):
                        session.rollback(); summary.skipped += 1; run.skipped += 1
                    if request_delay: time.sleep(request_delay)
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--indian", action="store_true", help="Import a Hindi-heavy mix of Indian films.")
    parser.add_argument("--indian-count", type=int, default=1000, help="Target count for --indian (default: 1000).")
    parser.add_argument("--media-type", choices=("movie", "tv"), default="movie", help="TMDb catalog type to import.")
    parser.add_argument("--pages", type=int, default=1, help="Popular movie pages to import (20 records per page).")
    parser.add_argument("--language", default="en-US", help="TMDb metadata language.")
    parser.add_argument("--request-delay", type=float, default=0.25, help="Seconds between movie detail requests.")
    parser.add_argument("--watch-region", default=None, help="ISO country code for TMDb watch availability links (defaults to IN with --indian, otherwise US).")
    args = parser.parse_args()
    if args.request_delay < 0:
        parser.error("--request-delay cannot be negative")

    if args.indian:
        summary = import_indian_movies(
            total=args.indian_count,
            request_delay=args.request_delay,
            watch_region=args.watch_region or "IN",
        )
    else:
        importer = import_popular_tv if args.media_type == "tv" else import_popular_movies
        summary = importer(
            pages=args.pages,
            language=args.language,
            request_delay=args.request_delay,
            watch_region=args.watch_region or WATCH_PROVIDER_REGION,
        )
    print(
        f"TMDb import run {summary.run_id} complete: {summary.added} added, "
        f"{summary.updated} updated, {summary.skipped} skipped."
    )


if __name__ == "__main__":
    main()
