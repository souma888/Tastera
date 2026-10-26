"""Aggregate recommendation evaluation reports for the ML Lab dashboard."""

from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import SessionLocal
from app.evaluate_recommendations import evaluate_category
from app.schemas.evaluation import EvaluationCategoryReport, EvaluationDashboardReport


router = APIRouter(prefix="/evaluation", tags=["evaluation"])


@router.get("/recommendations", response_model=EvaluationDashboardReport)
def get_recommendation_evaluation(
    category: Literal["Movies", "Books", "Music", "TV", "Games", "Podcasts", "all"] = "Movies",
    k: Annotated[int, Query(ge=1, le=50)] = 12,
) -> EvaluationDashboardReport:
    """Return aggregate metrics only, requiring the evaluator's 5-account floor."""

    categories = ("Movies", "Books", "Music", "TV", "Games", "Podcasts") if category == "all" else (category,)
    reports: list[EvaluationCategoryReport] = []
    try:
        with SessionLocal() as session:
            for name in categories:
                raw = evaluate_category(session, name, k=k)
                is_available = "method_results" in raw
                reports.append(EvaluationCategoryReport(
                    category=name,
                    k=k,
                    catalog_items=int(raw.get("catalog_items", 0)),
                    embedding_catalog_coverage=float(raw.get("embedding_catalog_coverage", 0)),
                    method_results=raw.get("method_results", {}),
                    status=(
                        str(raw["status"])
                        if is_available
                        else "Insufficient anonymous aggregate cohort; no individual data is exposed."
                    ),
                    available=is_available,
                ))
    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Evaluation data is not ready; apply the database migration and verify the app database is available.",
        ) from error
    return EvaluationDashboardReport(reports=reports)
