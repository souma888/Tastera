"""Item-item collaborative filtering for offline recommendation experiments."""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix
from sklearn.metrics.pairwise import cosine_similarity


class ItemItemCollaborativeRecommender:
    """Rank unseen movies by cosine similarity to a user's training history.

    Ratings are centered around each user's training mean before similarities are
    scored. The model must be fitted only on the training split. It intentionally
    returns fewer than ``n`` items when the user's history has no positive
    collaborative signal for additional candidates.
    """

    def fit(self, ratings: pd.DataFrame, movies: pd.DataFrame) -> "ItemItemCollaborativeRecommender":
        required_ratings = {"userId", "movieId", "rating"}
        required_movies = {"movieId", "title"}
        missing_ratings = required_ratings - set(ratings.columns)
        missing_movies = required_movies - set(movies.columns)
        if missing_ratings or missing_movies:
            raise ValueError(
                f"Missing columns: ratings={sorted(missing_ratings)}, movies={sorted(missing_movies)}"
            )
        if ratings.empty or movies.empty:
            raise ValueError("ratings and movies must not be empty")

        self.movies_ = movies[["movieId", "title"]].drop_duplicates("movieId").copy()
        self.movie_ids_ = self.movies_["movieId"].to_numpy()
        self.movie_index_ = {movie_id: index for index, movie_id in enumerate(self.movie_ids_)}
        self.user_ids_ = np.sort(ratings["userId"].unique())
        self.user_index_ = {user_id: index for index, user_id in enumerate(self.user_ids_)}

        known = ratings[
            ratings["movieId"].isin(self.movie_index_)
            & ratings["userId"].isin(self.user_index_)
        ].copy()
        user_means = known.groupby("userId")["rating"].transform("mean")
        centered = known["rating"].to_numpy(dtype=float) - user_means.to_numpy(dtype=float)
        rows = known["userId"].map(self.user_index_).to_numpy(dtype=int)
        columns = known["movieId"].map(self.movie_index_).to_numpy(dtype=int)
        self.user_item_ = csr_matrix(
            (centered, (rows, columns)),
            shape=(len(self.user_ids_), len(self.movie_ids_)),
            dtype=np.float32,
        )
        self.similarity_ = cosine_similarity(self.user_item_.T, dense_output=False).tocsr()
        self.similarity_.setdiag(0)
        self.similarity_.eliminate_zeros()
        self.rated_by_user_ = {
            user_id: set(group["movieId"].tolist())
            for user_id, group in known.groupby("userId")
        }
        return self

    def recommend_for_user(self, user_id: int, n: int = 10) -> pd.DataFrame:
        if not hasattr(self, "similarity_"):
            raise RuntimeError("Call fit before recommend_for_user.")
        if n < 1:
            raise ValueError("n must be at least 1")
        if user_id not in self.user_index_:
            return pd.DataFrame(columns=["movieId", "title", "cf_score"])

        user_row = self.user_index_[user_id]
        scores = (self.user_item_[user_row] @ self.similarity_).toarray().ravel()
        seen = self.rated_by_user_.get(user_id, set())
        candidates = self.movies_[~self.movies_["movieId"].isin(seen)].copy()
        candidates["cf_score"] = candidates["movieId"].map(
            lambda movie_id: scores[self.movie_index_[movie_id]]
        )
        candidates = candidates[candidates["cf_score"] > 0]
        return candidates.sort_values(
            ["cf_score", "title"], ascending=[False, True]
        ).head(n).reset_index(drop=True)
