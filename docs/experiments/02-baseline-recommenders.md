# Experiment 02 — Baseline Recommenders

## Objective
Establish transparent baselines before implementing more advanced personalized ranking.

## Methods
1. **Global-mean rating predictor:** predicts the mean rating in the training split for every user–movie pair.
2. **User-mean rating predictor:** predicts a user's mean training rating. Unknown users fall back to the global training mean.
3. **Popularity ranking:** ranks movies by number of training ratings, then by mean rating. A minimum rating-count threshold is applied.
4. **Genre-content ranking:** identifies genres from a user's highly rated movies (rating >= 4.0) and ranks unseen movies by genre overlap.

The first two methods are rating-prediction baselines. The latter two produce ranked recommendations. Their outputs should not be compared as if they measure the same task.

## Evaluation design
The notebook creates a chronological holdout using the 80th percentile of rating timestamps. Ratings strictly earlier than the cutoff are training data; ratings at or after it are test data. The models are fitted on training data only.

The notebook reports MAE and RMSE for the two rating predictors. Popularity and content examples are shown as qualitative recommendation lists. A future ranking-evaluation stage should add metrics such as Recall@K, Precision@K, and NDCG@K, with an explicit definition of relevant items and user eligibility.

## Limitations
- MovieLens Latest Small is a benchmark dataset, not a representative sample of all viewers or current streaming behavior.
- User-mean predictions are a simple baseline, not matrix factorization or a full collaborative-filtering model.
- Genre overlap is deliberately simple and cannot capture plot, cast, mood, language, or nuanced user taste.
- Popularity is prone to head-item bias.
- Timestamp splitting is more realistic than a random split for some scenarios, but it is not a complete simulation of a production recommendation system.
- Metrics should be interpreted alongside split details and data coverage.

## Reproducibility
Run `notebooks/02_baseline_recommenders.ipynb` from the repository. It saves rating metrics to `data/processed/baseline_rating_metrics.csv` and recommendation examples to `data/processed/`.
