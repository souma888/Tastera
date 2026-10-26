"""Import a small podcast catalog from Apple's free iTunes Search API.

Run with ``python -m app.import_podcasts``. No paid API or worker is required.
"""
import argparse
import math
import time

import httpx
from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.catalog import MediaIdentifier, MediaItemRecord
from app.services.import_tracking import catalog_import_run


def import_podcasts(*, terms: tuple[str, ...] = ("science", "history", "fiction", "comedy"), limit: int = 50, request_delay: float = 0.5) -> tuple[int, int, int, int]:
    added = updated = skipped = 0
    run_id = 0
    with httpx.Client(timeout=25, headers={"User-Agent": "Tastera catalog metadata importer"}) as client, SessionLocal() as session:
        with catalog_import_run(session, "itunes-podcasts") as run:
            run_id = run.id
            for term in terms:
                response = client.get("https://itunes.apple.com/search", params={"term": term, "media": "podcast", "entity": "podcast", "limit": min(limit, 200)})
                response.raise_for_status()
                for item in response.json().get("results", []):
                    external_id = str(item.get("collectionId", ""))
                    title = (item.get("collectionName") or "").strip()
                    if not external_id.isdigit() or not title:
                        skipped += 1; run.skipped += 1; continue
                    identifier = session.scalar(select(MediaIdentifier).where(MediaIdentifier.provider == "itunes-podcast", MediaIdentifier.external_id == external_id))
                    record = session.get(MediaItemRecord, identifier.media_item_id) if identifier else None
                    is_new = record is None
                    if record is None:
                        record = MediaItemRecord(id=f"itunes-podcast-{external_id}", title=title, creator=(item.get("artistName") or "Unknown publisher").strip(), category="Podcasts", primary_genre=(item.get("primaryGenreName") or "Podcast").strip(), description=item.get("description"), artwork_url=item.get("artworkUrl600") or item.get("artworkUrl100"), connection="Imported from Apple Podcasts metadata; no editorial relationships have been reviewed.", source="Apple iTunes Search", popularity_score=math.log1p(item.get("trackCount", 0) or 0), identifiers=[MediaIdentifier(provider="itunes-podcast", external_id=external_id)])
                        session.add(record)
                    else:
                        record.title = title; record.creator = (item.get("artistName") or record.creator).strip()
                        record.description = item.get("description") or record.description
                        record.artwork_url = item.get("artworkUrl600") or item.get("artworkUrl100") or record.artwork_url
                    session.commit()
                    if is_new: added += 1; run.added += 1
                    else: updated += 1; run.updated += 1
                if request_delay: time.sleep(request_delay)
    return run_id, added, updated, skipped


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=50)
    args = parser.parse_args()
    if args.limit < 1 or args.limit > 200: parser.error("--limit must be between 1 and 200")
    run_id, added, updated, skipped = import_podcasts(limit=args.limit)
    print(f"Podcast import run {run_id} complete: {added} added, {updated} updated, {skipped} skipped.")


if __name__ == "__main__": main()
