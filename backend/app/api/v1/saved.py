"""Authenticated endpoints for the current account's saved media."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import get_current_account
from app.models.account import AccountRecord, SavedMediaRecord
from app.models.catalog import MediaItemRecord
from app.schemas.accounts import SavedMedia, SavedMediaPage
from app.schemas.media import MediaItem
from app.services.catalog import to_schema


router = APIRouter(prefix="/me/saved", tags=["saved media"])
SessionDep = Annotated[Session, Depends(get_session)]
AccountDep = Annotated[AccountRecord, Depends(get_current_account)]


@router.get("", response_model=SavedMediaPage)
def list_saved_media(session: SessionDep, account: AccountDep) -> SavedMediaPage:
    records = session.execute(
        select(MediaItemRecord, SavedMediaRecord.saved_at)
        .join(SavedMediaRecord, SavedMediaRecord.media_item_id == MediaItemRecord.id)
        .where(SavedMediaRecord.account_id == account.id)
        .order_by(SavedMediaRecord.saved_at.desc(), MediaItemRecord.title)
    ).all()
    return SavedMediaPage(
        items=[
            SavedMedia(**to_schema(record).model_dump(), saved_at=saved_at)
            for record, saved_at in records
        ]
    )


@router.put("/{media_id}", response_model=MediaItem)
def save_media(media_id: str, session: SessionDep, account: AccountDep) -> MediaItem:
    item = session.get(MediaItemRecord, media_id)
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Media item not found."
        )

    existing = session.scalar(
        select(SavedMediaRecord).where(
            SavedMediaRecord.account_id == account.id,
            SavedMediaRecord.media_item_id == media_id,
        )
    )
    if existing is None:
        session.add(SavedMediaRecord(account_id=account.id, media_item_id=media_id))
        session.commit()
    return to_schema(item)


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def unsave_media(media_id: str, session: SessionDep, account: AccountDep) -> Response:
    existing = session.scalar(
        select(SavedMediaRecord).where(
            SavedMediaRecord.account_id == account.id,
            SavedMediaRecord.media_item_id == media_id,
        )
    )
    if existing is not None:
        session.delete(existing)
        session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
