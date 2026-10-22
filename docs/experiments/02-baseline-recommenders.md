# Experiment 02 — Baseline Recommenders

## Objective
Establish transparent baselines before implementing more advanced personalized ranking.

## Methods
1. **Global-mean rating predictor:** predicts the mean rating in the training split for every user–movie pair.
2. **User-mean rating predictor:** predicts a user's mean training rating. Unknown users fall back to the global training mean.
3. **Popularity ranking:** ranks movies by number of training ratings, then by mean rating; also compares a Bayesian-smoothed mean that shrinks low-support movie ratings toward the training-set global mean.
4. **Genre-content ranking:** identifies genres from a user's highly rated movies (rating >= 4.0) and ranks unseen movies by genre overlap.
5. **Item-item collaborative filtering:** computes sparse cosine similarities between user-centered movie-rating vectors from training data and scores unseen movies from the user's training history. Validation sweeps co-rating shrinkage to reduce noisy similarities based on few shared raters.

The first two methods are rating-prediction baselines. Popularity, genre-content, and item-item methods produce ranked recommendations. Rating prediction and ranking results measure different tasks and should not be compared directly.

## Evaluation design
The rating-prediction section creates a global chronological holdout at the 80th percentile of rating timestamps. It reports MAE and RMSE for the global-mean and user-mean predictors; only the training split is used for fitting.

The ranking section uses a per-user chronological holdout: each user's latest 20% of interactions (at least one) are test data. A held-out rating >= 4.0 is relevant. Users need at least five training ratings, one training rating >= 4.0, and one relevant test rating. Recommendations exclude all training items. The first comparative run evaluated 590 of 610 users, with 80,419 training interactions, 20,417 test interactions, and 9,509 relevant test interactions. Those test results are recorded below as exploratory baselines.

Hyperparameter tuning uses a later 20% slice of the remaining ranking-training period; all candidates use the same 64,081 tuning-training interactions and 592 validation users. The 16,338 validation interactions contain 7,415 relevant ratings. No validation or final-test ratings are used to fit a candidate. Tuned parameters include popularity minimum support (5, 20, or 50), Bayesian prior weight (10 or 40), and item-item co-rating shrinkage (0, 10, or 50). Select by validation NDCG@10, while also reviewing recall, catalog coverage, and intra-list genre diversity. The previously inspected final holdout is not reused to select or retest the tuned configuration.

The executed notebook recorded Python 3.13.9, NumPy 2.3.5, pandas 2.3.3, SciPy 1.16.3, and scikit-learn 1.7.2.

Reported metrics are Precision@10 (fixed denominator 10), Recall@10, binary NDCG@10, and catalog coverage@10 (unique recommended catalog items divided by the 9,742-title catalog). Results from the recorded run:

| Ranking method | Precision@10 | Recall@10 | NDCG@10 | Catalog coverage@10 |
|---|---:|---:|---:|---:|
| Popularity | 0.0581 | 0.0490 | 0.0756 | 1.01% |
| Item-item collaborative filtering | 0.0376 | 0.0366 | 0.0485 | 16.88% |
| Genre-content | 0.0014 | 0.0012 | 0.0014 | 0.57% |

Popularity is the strongest of these three by NDCG@10 on this split. Item-item collaborative filtering has much broader catalog coverage but lower ranking relevance. Genre-only matching is weak on this dataset and evaluation. These are baseline results, not a tuned or production-validated model.

Validation tuning results:

| Configuration | Precision@10 | Recall@10 | NDCG@10 | Catalog coverage@10 | Intra-list genre diversity |
|---|---:|---:|---:|---:|---:|
| Item-item, shrinkage 50 | **0.0770** | **0.0864** | **0.1103** | 5.10% | 0.7672 |
| Item-item, shrinkage 10 | 0.0730 | 0.0804 | 0.1032 | 7.31% | 0.7722 |
| Popularity by count, min support 20 | 0.0569 | 0.0752 | 0.0823 | 0.79% | **0.7978** |
| Item-item, no shrinkage | 0.0316 | 0.0432 | 0.0511 | **17.65%** | 0.7702 |

The validation-selected candidate is item-item collaborative filtering with co-rating shrinkage 50. It improves validation NDCG@10 over the same model without shrinkage, with lower catalog coverage; shrinkage 10 is a nearby tradeoff with higher coverage and similar variety. This is validation evidence, not an independent final-test result. The full tuning table is retained in the notebook.

## Limitations
- MovieLens Latest Small is a benchmark dataset, not a representative sample of all viewers or current streaming behavior.
- User-mean predictions are a simple baseline, not matrix factorization or a full collaborative-filtering model.
- Genre overlap is deliberately simple and cannot capture plot, cast, mood, language, or nuanced user taste.
- The per-user chronological split evaluates observed future ratings, not unobserved impressions; the >=4.0 relevance rule and eligible-user criteria affect the results.
- Item-item shrinkage was selected on validation, not confirmed by an untouched final holdout; there is no cold-start fallback.
- Popularity is prone to head-item bias.
- Timestamp splitting is more realistic than a random split for some scenarios, but it is not a complete simulation of a production recommendation system.
- Metrics should be interpreted alongside split details, coverage, and the user's current recommender feedback signals.

## Reproducibility
Run `notebooks/02_baseline_recommenders.ipynb` from the repository. It saves rating metrics, ranking metrics, and recommendation examples to ignored files under `data/processed/` and retains compact results in the notebook output.
