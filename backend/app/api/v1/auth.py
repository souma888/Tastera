"""Account registration and login endpoints."""

from uuid import uuid4
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
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
from app.models.account import AccountRecord
from app.schemas.accounts import Account, AuthResponse, Credentials


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
