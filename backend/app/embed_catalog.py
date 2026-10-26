"""Embed catalog metadata with Sentence Transformers and store it in pgvector.

Run from ``backend`` after applying migrations: ``python -m app.embed_catalog``.
"""

from __future__ import annotations

import argparse

from app.core.database import SessionLocal
from app.services.semantic_search import embed_catalog


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--force", action="store_true", help="Re-embed every item.")
    args = parser.parse_args()
    if args.batch_size < 1 or args.batch_size > 256:
        parser.error("--batch-size must be between 1 and 256")
    with SessionLocal() as session:
        try:
            print(embed_catalog(session, batch_size=args.batch_size, force=args.force))
        except Exception:
            session.rollback()
            raise


if __name__ == "__main__":
    main()
