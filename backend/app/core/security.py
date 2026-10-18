"""Password hashing and signed bearer-token helpers."""

from datetime import UTC, datetime, timedelta
from os import getenv

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.models.account import AccountRecord


ACCESS_TOKEN_TTL_SECONDS = 12 * 60 * 60
TOKEN_ALGORITHM = "HS256"
password_hasher = PasswordHasher()
bearer_scheme = HTTPBearer(auto_error=False)


def _auth_secret() -> str:
    secret = getenv("TASTERA_AUTH_SECRET", "")
    if len(secret) < 32:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Account sign-in is not configured on this service.",
        )
    return secret


def ensure_auth_configured() -> None:
    """Fail before account changes if the signing secret is missing."""

    _auth_secret()


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, encoded_hash: str) -> bool:
    try:
        return password_hasher.verify(encoded_hash, password)
    except (InvalidHashError, VerificationError, VerifyMismatchError):
        return False


def create_access_token(account_id: str) -> str:
    now = datetime.now(UTC)
    return jwt.encode(
        {
            "sub": account_id,
            "iat": now,
            "exp": now + timedelta(seconds=ACCESS_TOKEN_TTL_SECONDS),
        },
        _auth_secret(),
        algorithm=TOKEN_ALGORITHM,
    )


def get_current_account(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: Session = Depends(get_session),
) -> AccountRecord:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in to access this resource.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            _auth_secret(),
            algorithms=[TOKEN_ALGORITHM],
            options={"require": ["sub", "exp", "iat"]},
        )
        account_id = payload.get("sub")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session is invalid or expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    account = session.get(AccountRecord, account_id) if isinstance(account_id, str) else None
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not found. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return account
