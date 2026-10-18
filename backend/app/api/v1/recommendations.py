"""Authenticated personalized recommendation endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import get_current_account
from app.models.account import AccountRecord
from app.models.account import RecommendationFeedbackRecord
from app.models.catalog import MediaItemRecord
from app.schemas.media import MediaCategory
from app.schemas.recommendations import (
    RecommendationFeedbackInput,
    RecommendationFeedbackResult,
    RecommendationPage,
)
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


@router.put("/feedback/{media_id}", response_model=RecommendationFeedbackResult)
def set_recommendation_feedback(
    media_id: str,
    payload: RecommendationFeedbackInput,
    session: Annotated[Session, Depends(get_session)],
    account: Annotated[AccountRecord, Depends(get_current_account)],
) -> RecommendationFeedbackResult:
    """Store or replace a recommendation signal for this account and item."""

    if session.get(MediaItemRecord, media_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media item not found.")
    record = session.scalar(
        select(RecommendationFeedbackRecord).where(
            RecommendationFeedbackRecord.account_id == account.id,
            RecommendationFeedbackRecord.media_item_id == media_id,
        )
    )
    if record is None:
        record = RecommendationFeedbackRecord(
            account_id=account.id,
            media_item_id=media_id,
            feedback=payload.feedback,
        )
        session.add(record)
    else:
        record.feedback = payload.feedback
    session.commit()
    return RecommendationFeedbackResult(media_id=media_id, feedback=payload.feedback)


@router.delete("/feedback/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def clear_recommendation_feedback(
    media_id: str,
    session: Annotated[Session, Depends(get_session)],
    account: Annotated[AccountRecord, Depends(get_current_account)],
) -> Response:
    """Remove a previous signal so it no longer affects ranking."""

    record = session.scalar(
        select(RecommendationFeedbackRecord).where(
            RecommendationFeedbackRecord.account_id == account.id,
            RecommendationFeedbackRecord.media_item_id == media_id,
        )
    )
    if record is not None:
        session.delete(record)
        session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
