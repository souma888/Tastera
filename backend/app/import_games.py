"""Import popular game metadata from IGDB using free Twitch developer credentials.

Set IGDB_CLIENT_ID and IGDB_CLIENT_SECRET, then run ``python -m app.import_games``.
The importer is on-demand and stores only catalog metadata, not user data.
"""
import argparse
import math
import os

import httpx
from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.catalog import Genre, MediaGenre, MediaIdentifier, MediaItemRecord
from app.services.import_tracking import catalog_import_run


def import_games(*, limit: int = 100) -> tuple[int, int, int, int]:
    client_id, client_secret = os.getenv("IGDB_CLIENT_ID"), os.getenv("IGDB_CLIENT_SECRET")
    if not client_id or not client_secret: raise RuntimeError("Set IGDB_CLIENT_ID and IGDB_CLIENT_SECRET from a Twitch developer application.")
    with httpx.Client(timeout=30) as client:
        token_response = client.post("https://id.twitch.tv/oauth2/token", data={"client_id": client_id, "client_secret": client_secret, "grant_type": "client_credentials"})
        token_response.raise_for_status()
        access_token = token_response.json()["access_token"]
        response = client.post("https://api.igdb.com/v4/games", headers={"Client-ID": client_id, "Authorization": f"Bearer {access_token}"}, content=f"fields id,name,summary,genres.name,cover.url,total_rating; sort total_rating desc; limit {limit};")
        response.raise_for_status()
        games = response.json()
    added = updated = skipped = 0
    run_id = 0
    with SessionLocal() as session, catalog_import_run(session, "igdb-games") as run:
        run_id = run.id
        for game in games:
            external_id, title = str(game.get("id", "")), (game.get("name") or "").strip()
            if not external_id.isdigit() or not title: skipped += 1; run.skipped += 1; continue
            identifier = session.scalar(select(MediaIdentifier).where(MediaIdentifier.provider == "igdb", MediaIdentifier.external_id == external_id))
            record = session.get(MediaItemRecord, identifier.media_item_id) if identifier else None
            is_new = record is None
            genre_names = [genre.get("name", "").strip() for genre in game.get("genres", []) if genre.get("name")]
            genre_rows = []
            for name in genre_names:
                genre = session.scalar(select(Genre).where(Genre.name == name))
                if genre is None: genre = Genre(name=name); session.add(genre); session.flush()
                genre_rows.append(genre)
            cover = (game.get("cover") or {}).get("url")
            if cover: cover = "https:" + cover.replace("t_thumb", "t_cover_big") if cover.startswith("//") else cover.replace("t_thumb", "t_cover_big")
            score = game.get("total_rating") or 0
            if record is None:
                record = MediaItemRecord(id=f"igdb-game-{external_id}", title=title, creator="Video game", category="Games", primary_genre=", ".join(genre_names) or "Game", description=game.get("summary"), artwork_url=cover, connection="Imported from IGDB; adaptation and creator relationships are not inferred from similarity.", source="IGDB", popularity_score=math.log1p(score), identifiers=[MediaIdentifier(provider="igdb", external_id=external_id)])
                session.add(record)
            else:
                record.title = title; record.primary_genre = ", ".join(genre_names) or record.primary_genre
                record.description = game.get("summary") or record.description; record.artwork_url = cover or record.artwork_url
                record.popularity_score = math.log1p(score)
            if genre_rows: record.genre_links.clear(); record.genre_links.extend(MediaGenre(genre=genre) for genre in genre_rows)
            session.commit()
            if is_new: added += 1; run.added += 1
            else: updated += 1; run.updated += 1
    return run_id, added, updated, skipped


def main():
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument("--limit", type=int, default=100); args = parser.parse_args()
    if args.limit < 1 or args.limit > 500: parser.error("--limit must be between 1 and 500")
    run_id, added, updated, skipped = import_games(limit=args.limit)
    print(f"Game import run {run_id} complete: {added} added, {updated} updated, {skipped} skipped.")


if __name__ == "__main__": main()
