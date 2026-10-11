"""Baseline recommendation algorithms for TASTERA."""
from .baselines import (
    ContentBasedRecommender,
    GlobalMeanRecommender,
    PopularityRecommender,
    UserMeanRecommender,
)

__all__ = [
    "ContentBasedRecommender",
    "GlobalMeanRecommender",
    "PopularityRecommender",
    "UserMeanRecommender",
]
