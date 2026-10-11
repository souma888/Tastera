import pandas as pd
import pytest

from tastera.recommenders.baselines import (
    ContentBasedRecommender,
    GlobalMeanRecommender,
    PopularityRecommender,
    UserMeanRecommender,
)


@pytest.fixture
def movies():
    return pd.DataFrame({
        "movieId": [1, 2, 3, 4],
        "title": ["Action One", "Action Two", "Drama One", "Comedy One"],
        "genres": ["Action|Adventure", "Action", "Drama", "Comedy"],
    })


@pytest.fixture
def ratings():
    return pd.DataFrame({
        "userId": [1, 1, 2, 2, 3, 3],
        "movieId": [1, 2, 1, 3, 2, 4],
        "rating": [5.0, 4.0, 3.0, 2.0, 4.0, 5.0],
        "timestamp": [1, 2, 3, 4, 5, 6],
    })


def test_global_mean_predicts_training_mean(ratings):
    model = GlobalMeanRecommender().fit(ratings)
    preds = model.predict([1, 99], [2, 100])
    assert len(preds) == 2
    assert preds[0] == pytest.approx(ratings.rating.mean())
    assert preds[1] == pytest.approx(ratings.rating.mean())


def test_user_mean_uses_global_fallback(ratings):
    model = UserMeanRecommender().fit(ratings)
    preds = model.predict([1, 999], [4, 1])
    assert preds[0] == pytest.approx(4.5)
    assert preds[1] == pytest.approx(ratings.rating.mean())


def test_popularity_recommends_only_eligible_movies(ratings, movies):
    model = PopularityRecommender().fit(ratings, movies, min_ratings=2)
    result = model.recommend(10)
    assert set(result.movieId).issubset({1, 2})
    assert len(result) == 2


def test_content_recommender_excludes_seen_movies(ratings, movies):
    model = ContentBasedRecommender().fit(movies)
    result = model.recommend_for_user(1, ratings, n=10)
    assert not set(result.movieId).intersection({1, 2})
    assert 3 in set(result.movieId)


def test_fit_rejects_empty_ratings():
    empty = pd.DataFrame(columns=["userId", "movieId", "rating"])
    with pytest.raises(ValueError):
        GlobalMeanRecommender().fit(empty)
