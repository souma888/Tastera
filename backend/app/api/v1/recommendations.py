"""Authenticated personalized recommendation endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import get_current_account
from app.models.account import AccountRecord
from app.schemas.media import MediaCategory
from app.schemas.recommendations import RecommendationPage
from app.services.recommendations import recommend_for_account


router = APIRouter(prefix="/me/recommendations", tags=["recommendations"])


@router.get("", response_model=RecommendationPage)
def get_recommendations(
    session: Annotated[Session, Depends(get_session)],
    account: Annotated[AccountRecord, Depends(get_current_account)],
    category: MediaCategory | None = None,
    limit: Annotated[int, Query(ge=1, le=20)] = 8,
) -> RecommendationPage:
    """Recommend unsaved catalog items using shared normalized genres."""

    return recommend_for_account(
        session, account_id=account.id, category=category, limit=limit
    )
