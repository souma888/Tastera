"""Account registration and login endpoints."""

from datetime import datetime, timezone
from uuid import uuid4
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import (
    ACCESS_TOKEN_TTL_SECONDS,
    create_access_token,
    ensure_auth_configured,
    get_current_account,
    hash_password,
    verify_password,
)
from app.models.account import AccountRecord, LibraryActivityRecord, RecommendationFeedbackRecord, SavedMediaRecord
from app.models.catalog import MediaItemRecord
from app.schemas.accounts import Account, AuthResponse, Credentials
from app.services.catalog import to_schema


router = APIRouter(prefix="/auth", tags=["accounts"])
SessionDep = Annotated[Session, Depends(get_session)]


def _auth_response(account: AccountRecord) -> AuthResponse:
    return AuthResponse(
        access_token=create_access_token(account.id),
        expires_in=ACCESS_TOKEN_TTL_SECONDS,
        account=Account(id=account.id, email=account.email),
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(credentials: Credentials, session: SessionDep) -> AuthResponse:
    ensure_auth_configured()
    email = str(credentials.email).strip().lower()
    if session.scalar(select(AccountRecord).where(AccountRecord.email == email)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Sign in instead.",
        )

    account = AccountRecord(
        id=str(uuid4()), email=email, password_hash=hash_password(credentials.password)
    )
    session.add(account)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Sign in instead.",
        ) from None
    session.refresh(account)
    return _auth_response(account)


@router.post("/login", response_model=AuthResponse)
def login(credentials: Credentials, session: SessionDep) -> AuthResponse:
    ensure_auth_configured()
    email = str(credentials.email).strip().lower()
    account = session.scalar(select(AccountRecord).where(AccountRecord.email == email))
    if account is None or not verify_password(credentials.password, account.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email or password is incorrect.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _auth_response(account)


@router.get("/me", response_model=Account)
def get_me(
    account: Annotated[AccountRecord, Depends(get_current_account)],
) -> Account:
    return Account(id=account.id, email=account.email)


@router.get("/me/export")
def export_me(
    session: SessionDep,
    account: Annotated[AccountRecord, Depends(get_current_account)],
) -> dict[str, object]:
    """Export the current account's server-stored personal data as JSON."""
    saved_rows = session.execute(
        select(SavedMediaRecord, MediaItemRecord)
        .join(MediaItemRecord, SavedMediaRecord.media_item_id == MediaItemRecord.id)
        .where(SavedMediaRecord.account_id == account.id)
        .order_by(SavedMediaRecord.saved_at)
    ).all()
    feedback_rows = session.scalars(
        select(RecommendationFeedbackRecord).where(
            RecommendationFeedbackRecord.account_id == account.id
        )
    ).all()
    activity_rows = session.scalars(
        select(LibraryActivityRecord)
        .where(LibraryActivityRecord.account_id == account.id)
        .order_by(LibraryActivityRecord.created_at)
    ).all()
    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "account": {"id": account.id, "email": account.email, "created_at": account.created_at.isoformat()},
        "library": [
            {
                **to_schema(media).model_dump(mode="json"),
                "saved_at": saved.saved_at.isoformat(),
                "status": saved.status,
                "rating": saved.rating,
                "note": saved.note,
                "progress_percent": saved.progress_percent,
                "updated_at": saved.updated_at.isoformat(),
            }
            for saved, media in saved_rows
        ],
        "recommendation_feedback": [
            {"media_id": row.media_item_id, "feedback": row.feedback, "updated_at": row.updated_at.isoformat()}
            for row in feedback_rows
        ],
        "library_activity": [
            {"media_id": row.media_item_id, "event_type": row.event_type, "value": row.value, "created_at": row.created_at.isoformat()}
            for row in activity_rows
        ],
        "note": "Collections and taste setup currently live in this browser and are not stored by the API.",
    }


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_me(
    session: SessionDep,
    account: Annotated[AccountRecord, Depends(get_current_account)],
) -> Response:
    """Permanently delete the signed-in account and account-scoped server data."""
    session.execute(delete(LibraryActivityRecord).where(LibraryActivityRecord.account_id == account.id))
    session.execute(delete(RecommendationFeedbackRecord).where(RecommendationFeedbackRecord.account_id == account.id))
    session.execute(delete(SavedMediaRecord).where(SavedMediaRecord.account_id == account.id))
    session.delete(account)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
