# Recommendation and Machine-Learning Roadmap

## What exists today

The deployed app also serves a simple genre-weighted recommendation baseline through the backend. It uses saved genres and per-account `more`/`less` feedback. This is useful product functionality, but it is not the same as a trained/evaluated model and does not establish cross-media recommendation quality. The research items below remain open unless actual run results are recorded.

The repository includes an offline recommendation research foundation:

- `src/tastera/recommenders/baselines.py`: global mean, user mean, popularity, and genre-overlap content-based baselines.
- `notebooks/01_dataset_audit.ipynb`: MovieLens data inspection.
- `notebooks/02_baseline_recommenders.ipynb`: baseline experiment notebook.
- `docs/experiments/01-movielens-audit.md` and `docs/experiments/02-baseline-recommenders.md`: experiment notes.

These components should be treated as research baselines, not a trained, deployed, cross-media ML system. Verify the notebooks run top-to-bottom in the current environment before claiming their results are reproducible.

## Stage 1 — Validate the dataset

Before model comparisons, verify the following in a fresh local run. The committed audit output already records checks for duplicate `(userId, movieId)` pairs and the half-star rating scale, but those results have not been freshly reproduced after the latest notebook edits:

- Required columns and data types.
- Duplicate `(userId, movieId)` rating pairs and how any are handled.
- Rating values against the dataset's documented rating scale.
- Movie-ID joins between ratings and metadata.
- Missing values and identifier coverage.
- Timestamp interpretation and split boundaries.
- Dataset license/terms and local data placement.

Keep raw data out of Git. Record the source, version/download date, required files, transformations, and any limitations in the dataset register.

## Stage 2 — Establish baselines

Run the existing baseline notebook and record actual results, package versions, random seeds where applicable, and split definition. Do not invent or manually estimate metrics.

For rating prediction, report MAE and RMSE where appropriate. For top-K ranking, define which items count as relevant and which users/items are eligible for evaluation before calculating metrics.

## Stage 3 — Correct evaluation protocol

- Use a documented train/validation/test split.
- A temporal split is a useful option when timestamped interactions are available; train only on interactions before the cutoff and evaluate on later interactions.
- Fit learned preprocessing only on training data.
- Prevent test interactions from influencing user/item features, popularity counts, or candidate generation.
- Compare all candidate models on the same split and candidate set.
- Report metrics with their definitions and limitations.

Potential ranking metrics include Precision@K, Recall@K, NDCG@K, catalog coverage, and intra-list diversity. Offline results do not guarantee user satisfaction.

## Stage 4 — Content-based ranking

Begin with transparent features available in the data, such as genres and tags. TF-IDF can be evaluated for text fields if suitable descriptions are available. Compare against a simple genre-overlap baseline and inspect example recommendations manually.

## Stage 5 — Collaborative filtering

Explore interaction-matrix methods only after establishing a clean split and baseline. MovieLens is useful for movie recommendation research but does not directly provide cross-media user behavior for books and music. Sparse interaction data and cold-start users/items must be considered.

## Stage 6 — Hybrid and discovery-aware ranking

Evaluate a hybrid of content relevance, interaction signals, and popularity. If justified by results, add diversity/novelty reranking and explanations. Keep a simple fallback for new users and items with little metadata.

## Stage 7 — Cross-media representation

Cross-media recommendations require additional evidence. Potential ingredients include normalized metadata, shared creators, themes, tags, licensed descriptions, semantic embeddings, and explicit relationships with provenance. Similar embeddings alone are not proof that a user will like both items.

Do not claim a cross-media model until it has been implemented and evaluated on an appropriate dataset or carefully designed user study.

## Stage 8 — Serving and reproducibility

Once an approach performs adequately:

1. Move reusable inference logic out of notebooks into tested Python modules.
2. Save model configuration and artifacts with a version and training-data reference.
3. Define an inference input/output contract.
4. Add API integration tests and a deterministic fallback.
5. Document model limitations, latency, and update/retraining procedure.

A GPU or deep neural network is not a requirement for the first credible recommender. Start with measurable baselines and increase complexity only when evidence supports it.
