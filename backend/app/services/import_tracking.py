"""Persist the outcome of catalog import jobs."""

from collections.abc import Iterator
from datetime import UTC, datetime
from contextlib import contextmanager

from sqlalchemy.orm import Session

from app.models.catalog import CatalogImportRunRecord


@contextmanager
def catalog_import_run(
    session: Session, provider: str
) -> Iterator[CatalogImportRunRecord]:
    """Record a running import and persist its final status and counters."""
    run = CatalogImportRunRecord(provider=provider, status="running")
    session.add(run)
    session.commit()
    session.refresh(run)
    try:
        yield run
    except Exception as error:
        session.rollback()
        run = session.get(CatalogImportRunRecord, run.id)
        if run is not None:
            run.status = "failed"
            run.finished_at = datetime.now(UTC)
            run.error_message = str(error)[:2000]
            session.commit()
        raise
    else:
        run.status = "completed"
        run.finished_at = datetime.now(UTC)
        session.commit()
