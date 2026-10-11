"""Simple, transparent recommenders used as TASTERA baselines.

Expected MovieLens columns:
ratings: userId, movieId, rating, timestamp
movies: movieId, title, genres
"""
from __future__ import annotations

import numpy as np
import pandas as pd


_REQUIRED_RATINGS = {"userId", "movieId", "rating"}
_REQUIRED_MOVIES = {"movieId", "title", "genres"}


def _require_columns(frame: pd.DataFrame, required: set[str], name: str) -> None:
    missing = required - set(frame.columns)
    if missing:
        raise ValueError(f"{name} is missing required columns: {sorted(missing)}")


class GlobalMeanRecommender:
    """Predict every rating using the training-set global mean."""

    def fit(self, ratings: pd.DataFrame) -> "GlobalMeanRecommender":
        _require_columns(ratings, _REQUIRED_RATINGS, "ratings")
        if ratings.empty:
            raise ValueError("ratings must not be empty")
        self.global_mean_ = float(ratings["rating"].mean())
        return self

    def predict(self, user_ids, movie_ids) -> np.ndarray:
        if not hasattr(self, "global_mean_"):
            raise RuntimeError("Call fit before predict.")
        users, movies = list(user_ids), list(movie_ids)
        if len(users) != len(movies):
            raise ValueError("user_ids and movie_ids must have equal lengths")
        return np.full(len(users), self.global_mean_, dtype=float)


class UserMeanRecommender:
    """Predict with each user's training mean, falling back to global mean.

    This is a simple baseline, not a latent-factor collaborative-filtering model.
    """

    def fit(self, ratings: pd.DataFrame) -> "UserMeanRecommender":
        _require_columns(ratings, _REQUIRED_RATINGS, "ratings")
        if ratings.empty:
            raise ValueError("ratings must not be empty")
        self.global_mean_ = float(ratings["rating"].mean())
        self.user_means_ = ratings.groupby("userId")["rating"].mean().to_dict()
        return self

    def predict(self, user_ids, movie_ids) -> np.ndarray:
        if not hasattr(self, "user_means_"):
            raise RuntimeError("Call fit before predict.")
        users, movies = list(user_ids), list(movie_ids)
        if len(users) != len(movies):
            raise ValueError("user_ids and movie_ids must have equal lengths")
        return np.array(
            [self.user_means_.get(user, self.global_mean_) for user in users],
            dtype=float,
        )


class PopularityRecommender:
    """Rank movies by training-set rating count, with mean rating as tie-breaker.

    The minimum rating count prevents a movie with one high rating from outranking
    established titles. Only training ratings should be passed to fit().
    """

    def fit(
        self, ratings: pd.DataFrame, movies: pd.DataFrame, min_ratings: int = 20
    ) -> "PopularityRecommender":
        _require_columns(ratings, _REQUIRED_RATINGS, "ratings")
        _require_columns(movies, _REQUIRED_MOVIES, "movies")
        if min_ratings < 1:
            raise ValueError("min_ratings must be at least 1")
        stats = (
            ratings.groupby("movieId")["rating"]
            .agg(mean_rating="mean", rating_count="count")
            .reset_index()
        )
        eligible = stats[stats["rating_count"] >= min_ratings]
        self.ranked_movies_ = (
            eligible.merge(movies[["movieId", "title", "genres"]], on="movieId", how="left")
            .sort_values(["rating_count", "mean_rating", "title"],
                         ascending=[False, False, True])
            .reset_index(drop=True)
        )
        self.min_ratings_ = min_ratings
        return self

    def recommend(self, n: int = 10, exclude_movie_ids=None) -> pd.DataFrame:
        if not hasattr(self, "ranked_movies_"):
            raise RuntimeError("Call fit before recommend.")
        if n < 1:
            raise ValueError("n must be at least 1")
        excluded = set(exclude_movie_ids or [])
        return self.ranked_movies_[
            ~self.ranked_movies_["movieId"].isin(excluded)
        ].head(n).reset_index(drop=True).copy()


class ContentBasedRecommender:
    """Recommend movies sharing genres with movies a user liked.

    A movie is treated as liked when its rating is >= like_threshold. Scores are
    genre-overlap counts normalized by the number of genres in the candidate.
    This transparent baseline uses metadata, not learned embeddings.
    """

    def fit(self, movies: pd.DataFrame) -> "ContentBasedRecommender":
        _require_columns(movies, _REQUIRED_MOVIES, "movies")
        self.movies_ = movies[["movieId", "title", "genres"]].copy()
        self.movies_["genres"] = self.movies_["genres"].fillna("")
        self.genre_sets_ = {
            int(row.movieId): set(
                g for g in str(row.genres).split("|") if g and g != "(no genres listed)"
            )
            for row in self.movies_.itertuples(index=False)
        }
        return self

    def recommend_for_user(
        self,
        user_id,
        ratings: pd.DataFrame,
        n: int = 10,
        like_threshold: float = 4.0,
    ) -> pd.DataFrame:
        if not hasattr(self, "movies_"):
            raise RuntimeError("Call fit before recommend_for_user.")
        _require_columns(ratings, _REQUIRED_RATINGS, "ratings")
        if n < 1:
            raise ValueError("n must be at least 1")
        user_ratings = ratings[ratings["userId"] == user_id]
        seen = set(user_ratings["movieId"].astype(int))
        liked = user_ratings[user_ratings["rating"] >= like_threshold]["movieId"]
        liked_genres = set()
        for movie_id in liked:
            liked_genres |= self.genre_sets_.get(int(movie_id), set())

        candidates = self.movies_[~self.movies_["movieId"].isin(seen)].copy()
        if not liked_genres:
            candidates["content_score"] = 0.0
        else:
            def score(movie_id):
                genres = self.genre_sets_.get(int(movie_id), set())
                return len(genres & liked_genres) / max(len(genres), 1)
            candidates["content_score"] = candidates["movieId"].map(score)

        candidates["matched_genres"] = candidates["movieId"].map(
            lambda mid: ", ".join(sorted(self.genre_sets_.get(int(mid), set()) & liked_genres))
        )
        return candidates.sort_values(
            ["content_score", "title"], ascending=[False, True]
        ).head(n).reset_index(drop=True)
