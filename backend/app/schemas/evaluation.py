"""Privacy-limited aggregate recommender evaluation responses."""

from pydantic import BaseModel, Field


class EvaluationMetrics(BaseModel):
    hit_rate_at_k: float = Field(ge=0, le=1)
    precision_at_k: float = Field(ge=0, le=1)
    recall_at_k: float = Field(ge=0, le=1)
    ndcg_at_k: float = Field(ge=0, le=1)
    catalog_coverage: float = Field(ge=0, le=1)
    mean_intra_list_diversity: float = Field(ge=0, le=1)


class EvaluationCategoryReport(BaseModel):
    category: str
    k: int
    catalog_items: int
    embedding_catalog_coverage: float = Field(ge=0, le=1)
    method_results: dict[str, EvaluationMetrics]
    status: str
    available: bool


class EvaluationDashboardReport(BaseModel):
    reports: list[EvaluationCategoryReport]
