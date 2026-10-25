from datetime import datetime, timezone
from types import SimpleNamespace

from app.api.v1 import saved
from app.schemas.media import MediaCategory, MediaItem


def test_library_item_uses_saved_record_updated_at(monkeypatch):
    catalog_updated_at = datetime(2026, 10, 20, tzinfo=timezone.utc)
    library_updated_at = datetime(2026, 10, 25, tzinfo=timezone.utc)
    saved_at = datetime(2026, 10, 24, tzinfo=timezone.utc)

    media_schema = MediaItem(
        id="after-hours",
        title="After Hours",
        creator="Example Creator",
        category=MediaCategory.MOVIES,
        genre="Drama",
        image=None,
        description=None,
        connection="A test catalog connection",
        source="test",
        updated_at=catalog_updated_at,
    )
    monkeypatch.setattr(saved, "to_schema", lambda _media: media_schema)

    record = SimpleNamespace(
        saved_at=saved_at,
        status="planned",
        rating=None,
        note=None,
        progress_percent=None,
        updated_at=library_updated_at,
    )

    result = saved._library_item(record, object())

    assert result.id == "after-hours"
    assert result.saved_at == saved_at
    assert result.updated_at == library_updated_at
    assert result.status == "planned"
