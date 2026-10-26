"""Optional grounded phrasing for structured catalog connections."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import get_current_account
from app.models.account import AccountRecord
from app.schemas.ai import ConnectionExplanation, ConnectionExplanationInput
from app.services.explanations import explain_connection


router = APIRouter(prefix="/ai", tags=["AI explanations"])


@router.post("/connection-explanation", response_model=ConnectionExplanation)
def get_connection_explanation(
    payload: ConnectionExplanationInput,
    session: Annotated[Session, Depends(get_session)],
    _account: Annotated[AccountRecord, Depends(get_current_account)],
) -> ConnectionExplanation:
    """Ask an optional LLM to phrase server-derived catalog evidence."""

    result = explain_connection(session, payload.source_id, payload.target_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Both distinct catalog items must exist.")
    return result
