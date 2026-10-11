# Experiment 02 — Baseline Recommenders

## Status

**Planned.** This document defines the first comparison; it does not claim that any recommender has been trained or evaluated.

## Objective

Build simple, reproducible reference models before investing in more complex recommendation approaches. Establish a common evaluation protocol and compare rating prediction quality, ranking quality, coverage, and cold-start behavior.

## Dataset

Use the locally stored MovieLens Latest Small data described in [the dataset register](../dataset-register.md). The audit observed 100,836 ratings from 610 users across 9,724 rated movies. The interaction matrix is 98.3000% sparse. The dataset's rating timestamps span 1996–2018 UTC, so split strategy must be chosen to match the intended evaluation question.

Before training, run the follow-up validation in [Experiment 01](01-movielens-audit.md) and record the duplicate `(userId, movieId)` pair count and rating-scale check.

## Baselines to compare

1. **Global-mean rating baseline** — predict the training-set mean for every user/movie pair. This is a simple rating-prediction reference.
2. **Item-popularity baseline** — rank movies using training-only interaction counts; optionally break ties using training-only mean rating with a minimum-support rule defined before evaluation.
3. **Genre/content baseline** — represent movies using multi-hot genre features and compare them with a user's genre preference profile computed only from training interactions. Title text may be added as a separately reported variant.
4. **Collaborative-filtering baseline** — start with a simple user-based or item-based neighborhood method, or a low-rank model, and fit it only on training interactions.

Keep each baseline's implementation, hyperparameters, and metric definitions explicit. Do not tune using the held-out test set.

## Evaluation split and leakage controls

### Recommended first protocol

Use a **per-user temporal holdout** for users with enough interactions: sort each user's ratings by timestamp, use the earlier interactions for training, and reserve the latest interaction(s) for testing. Define the minimum-history rule and holdout count before running the experiment. Users without enough history should be reported separately rather than silently dropped.

This protocol asks whether the system can predict later preferences from earlier observed history. It is not the only valid protocol; if the product's intended use is explicitly non-temporal, add a separately labeled random-split experiment rather than mixing results.

### Required safeguards

- Fit genre preference profiles, popularity counts, rating means, text vectorizers, feature scaling, and any learned transformations using training data only.
- Do not allow test interactions to contribute to item popularity, user profiles, item similarities, vocabulary fitting, or model parameters.
- If tuning is required, use a validation split from training history; leave the final test holdout untouched until model selection is complete.
- Ensure recommendations exclude items the user had already interacted with in the training period when evaluating novel-item ranking.
- State how users with only one or very few ratings are handled, and report coverage instead of hiding unsupported predictions.
- If timestamps tie, use a deterministic, documented tie-breaking rule; do not rely on incidental CSV row order.
- Keep all source CSVs unchanged and save split definitions or random seeds needed to reproduce results.

## Metrics

Report the metrics appropriate to each task and never compare values computed on different test sets as if directly comparable.

- **Rating prediction:** MAE and RMSE on held-out ratings.
- **Top-N ranking:** Recall@K and NDCG@K; specify K and the rule used to define relevant items.
- **Coverage:** fraction of eligible users for whom the model can produce recommendations, plus catalog coverage.
- **Diagnostics:** results by user-history bucket and a clear note about cold-start users/items.

MovieLens ratings are explicit ratings, not a direct record of clicks or purchases. Any binary relevance threshold for ranking is a modeling choice and must be documented before evaluating results.

## Experiment table

Fill this table only after running the models.

| Model | Split/protocol | MAE | RMSE | Recall@K | NDCG@K | User coverage | Catalog coverage |
|---|---|---:|---:|---:|---:|---:|---:|
| Global mean | Per-user temporal holdout | — | — | N/A | N/A | — | N/A |
| Item popularity | Per-user temporal holdout | N/A | N/A | — | — | — | — |
| Genre/content | Per-user temporal holdout | — | — | — | — | — | — |
| Collaborative filtering | Per-user temporal holdout | — | — | — | — | — | — |

## Acceptance criteria

- The split is reproducible and documented.
- No test information is used to fit features, popularity counts, profiles, or model parameters.
- Every metric has a documented definition and uses the same eligible test population where comparison requires it.
- Coverage and cold-start behavior are reported alongside quality metrics.
- No model is declared best until the results have been generated and reviewed.

## Next steps

1. Complete Experiment 01's follow-up validation.
2. Implement the split as a tested, reusable function.
3. Implement the global-mean and popularity baselines first.
4. Add content-based and collaborative-filtering baselines under the same evaluation protocol.
5. Record results, environment, configuration, and known limitations.
