"""Load manually reviewed relationship and creator-alias CSV files.

Relationships CSV columns: source_id,target_id,type,provenance,source_url,confidence.
Aliases CSV columns: alias,canonical_name,provenance,source_url.
This command never infers a factual relationship from semantic similarity.
"""
import argparse
import csv
from pathlib import Path

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.catalog import CreatorAliasRecord, MediaItemRecord, MediaRelationshipRecord


def import_links(*, relationships: Path | None, aliases: Path | None) -> tuple[int, int, int]:
    linked = merged = skipped = 0
    with SessionLocal() as session:
        if relationships:
            with relationships.open(newline="", encoding="utf-8-sig") as source:
                for row in csv.DictReader(source):
                    source_id, target_id = row.get("source_id", "").strip(), row.get("target_id", "").strip()
                    rel_type, provenance = row.get("type", "").strip(), row.get("provenance", "").strip()
                    if not source_id or not target_id or source_id == target_id or not rel_type or not provenance or not session.get(MediaItemRecord, source_id) or not session.get(MediaItemRecord, target_id):
                        skipped += 1; continue
                    existing = session.scalar(select(MediaRelationshipRecord).where(MediaRelationshipRecord.source_media_id == source_id, MediaRelationshipRecord.target_media_id == target_id, MediaRelationshipRecord.relationship_type == rel_type))
                    if existing: skipped += 1; continue
                    try: confidence = float(row.get("confidence") or 1)
                    except ValueError: skipped += 1; continue
                    if not 0 <= confidence <= 1: skipped += 1; continue
                    session.add(MediaRelationshipRecord(source_media_id=source_id, target_media_id=target_id, relationship_type=rel_type, provenance=provenance[:200], source_url=row.get("source_url") or None, confidence=confidence)); linked += 1
            session.commit()
        if aliases:
            with aliases.open(newline="", encoding="utf-8-sig") as source:
                for row in csv.DictReader(source):
                    alias, canonical, provenance = row.get("alias", "").strip(), row.get("canonical_name", "").strip(), row.get("provenance", "").strip()
                    if not alias or not canonical or not provenance: skipped += 1; continue
                    if session.scalar(select(CreatorAliasRecord).where(CreatorAliasRecord.alias.ilike(alias))): skipped += 1; continue
                    session.add(CreatorAliasRecord(alias=alias, canonical_name=canonical, provenance=provenance[:200], source_url=row.get("source_url") or None)); merged += 1
            session.commit()
    return linked, merged, skipped


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--relationships", type=Path)
    parser.add_argument("--aliases", type=Path)
    args = parser.parse_args()
    if not args.relationships and not args.aliases: parser.error("provide --relationships and/or --aliases")
    linked, merged, skipped = import_links(relationships=args.relationships, aliases=args.aliases)
    print(f"Catalog links imported: {linked} relationships, {merged} creator aliases, {skipped} skipped.")


if __name__ == "__main__": main()
