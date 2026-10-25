"""Authenticated endpoints for saved media and private Library activity."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import get_current_account
from app.models.account import AccountRecord, LibraryActivityRecord, SavedMediaRecord
from app.models.catalog import MediaItemRecord
from app.schemas.accounts import (
    LibraryActivity,
    LibraryActivityPage,
    SavedMedia,
    SavedMediaPage,
    SavedMediaUpdate,
)
from app.services.catalog import to_schema


router = APIRouter(prefix="/me/saved", tags=["saved media"])
SessionDep = Annotated[Session, Depends(get_session)]
AccountDep = Annotated[AccountRecord, Depends(get_current_account)]


def _library_item(record: SavedMediaRecord, media: MediaItemRecord) -> SavedMedia:
    return SavedMedia(
        **to_schema(media).model_dump(),
        saved_at=record.saved_at,
        status=record.status,
        rating=record.rating,
        note=record.note,
        progress_percent=record.progress_percent,
        updated_at=record.updated_at,
    )


def _add_activity(
    session: Session,
    account_id: str,
    media_id: str,
    event_type: str,
    value: str | None = None,
) -> None:
    session.add(LibraryActivityRecord(
        account_id=account_id,
        media_item_id=media_id,
        event_type=event_type,
        value=value,
    ))


@router.get("", response_model=SavedMediaPage)
def list_saved_media(session: SessionDep, account: AccountDep) -> SavedMediaPage:
    rows = session.execute(
        select(SavedMediaRecord, MediaItemRecord)
        .join(MediaItemRecord, SavedMediaRecord.media_item_id == MediaItemRecord.id)
        .where(SavedMediaRecord.account_id == account.id)
        .order_by(SavedMediaRecord.saved_at.desc(), MediaItemRecord.title)
    ).all()
    return SavedMediaPage(items=[_library_item(saved, media) for saved, media in rows])


@router.get("/activity", response_model=LibraryActivityPage)
def list_library_activity(
    session: SessionDep,
    account: AccountDep,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> LibraryActivityPage:
    rows = session.execute(
        select(LibraryActivityRecord, MediaItemRecord)
        .join(MediaItemRecord, LibraryActivityRecord.media_item_id == MediaItemRecord.id)
        .where(LibraryActivityRecord.account_id == account.id)
        .order_by(LibraryActivityRecord.created_at.desc(), LibraryActivityRecord.id.desc())
        .limit(limit)
    ).all()
    return LibraryActivityPage(items=[
        LibraryActivity(
            id=event.id,
            media_id=media.id,
            title=media.title,
            category=media.category,
            event_type=event.event_type,
            value=event.value,
            created_at=event.created_at,
        )
        for event, media in rows
    ])


@router.put("/{media_id}", response_model=SavedMedia)
def save_media(media_id: str, session: SessionDep, account: AccountDep) -> SavedMedia:
    media = session.get(MediaItemRecord, media_id)
    if media is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media item not found.")

    saved = session.scalar(select(SavedMediaRecord).where(
        SavedMediaRecord.account_id == account.id,
        SavedMediaRecord.media_item_id == media_id,
    ))
    if saved is None:
        saved = SavedMediaRecord(account_id=account.id, media_item_id=media_id)
        session.add(saved)
        session.flush()
        _add_activity(session, account.id, media_id, "saved", "planned")
        session.commit()
        session.refresh(saved)
    return _library_item(saved, media)


@router.patch("/{media_id}", response_model=SavedMedia)
def update_saved_media(
    media_id: str,
    payload: SavedMediaUpdate,
    session: SessionDep,
    account: AccountDep,
) -> SavedMedia:
    saved = session.scalar(select(SavedMediaRecord).where(
        SavedMediaRecord.account_id == account.id,
        SavedMediaRecord.media_item_id == media_id,
    ))
    if saved is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Save this item before updating it.")
    media = session.get(MediaItemRecord, media_id)
    if media is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media item not found.")

    fields = payload.model_fields_set
    changed = False
    if "status" in fields:
        if payload.status is None:
            raise HTTPException(status_code=422, detail="Status cannot be cleared.")
        if saved.status != payload.status:
            saved.status = payload.status
            _add_activity(session, account.id, media_id, "status", payload.status)
            changed = True
    if "rating" in fields and saved.rating != payload.rating:
        saved.rating = payload.rating
        _add_activity(session, account.id, media_id, "rating", str(payload.rating) if payload.rating is not None else "cleared")
        changed = True
    if "note" in fields:
        note = (payload.note or "").strip() or None
        if saved.note != note:
            saved.note = note
            _add_activity(session, account.id, media_id, "note", "cleared" if note is None else "updated")
            changed = True
    if "progress_percent" in fields and saved.progress_percent != payload.progress_percent:
        saved.progress_percent = payload.progress_percent
        _add_activity(session, account.id, media_id, "progress", str(payload.progress_percent) if payload.progress_percent is not None else "cleared")
        changed = True

    if changed:
        session.commit()
        session.refresh(saved)
    return _library_item(saved, media)


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def unsave_media(media_id: str, session: SessionDep, account: AccountDep) -> Response:
    existing = session.scalar(select(SavedMediaRecord).where(
        SavedMediaRecord.account_id == account.id,
        SavedMediaRecord.media_item_id == media_id,
    ))
    if existing is not None:
        _add_activity(session, account.id, media_id, "removed", existing.status)
        session.delete(existing)
        session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
