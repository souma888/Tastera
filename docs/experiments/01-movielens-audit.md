# Experiment 01 — MovieLens Dataset Audit

## Status

**Freshly rerun on 2026-10-22.** `notebooks/01_dataset_audit.ipynb` completed top-to-bottom against the local MovieLens Latest Small files with no cell errors. The checks below were reproduced in Python 3.13.3, pandas 3.0.6, and NumPy 2.5.4. Rerun the notebook if the local dataset changes.

## Objective

Establish a reproducible understanding of the MovieLens Latest Small files before cleaning data or selecting a recommendation algorithm.

## Dataset and provenance

- Source: GroupLens MovieLens Latest Small
- Official archive: https://files.grouplens.org/datasets/movielens/ml-latest-small.zip
- Local expected directory: `data/raw/movielens/ml-latest-small/`
- Source inventory and restrictions: see [dataset register](../dataset-register.md).

## Inventory

| File | Rows | Columns |
|---|---:|---:|
| movies.csv | 9,742 | 3 |
| ratings.csv | 100,836 | 4 |
| tags.csv | 3,683 | 4 |
| links.csv | 9,742 | 3 |

Schemas:
- Movies: `movieId, title, genres`
- Ratings: `userId, movieId, rating, timestamp`
- Tags: `userId, movieId, tag, timestamp`
- Links: `movieId, imdbId, tmdbId`

## Findings from the executed notebook

### Missing values and duplicates

- No missing values were observed in the inspected movie, rating, or tag columns.
- `links.tmdbId` has 8 missing values (8 / 9,742 = 0.0821%); IMDb identifier coverage is 100%.
- No duplicate full rows were observed in any of the four CSV files.
- The catalog's `movieId` and the links table's `movieId` are unique.
- No rating or tag movie IDs were found outside the movie catalog.
- **Follow-up validation result:** 0 duplicate `(userId, movieId)` pairs, 0 missing rating values, and no observed rating values outside the expected half-star scale (`0.5` through `5.0` in `0.5` increments), according to the notebook's recorded output.

### Ratings and activity

| Metric | Result |
|---|---:|
| Rating count | 100,836 |
| Mean rating | 3.5016 |
| Median rating | 3.5 |
| Rating standard deviation | 1.0425 |
| Observed minimum / maximum | 0.5 / 5.0 |
| Distinct users | 610 |
| Distinct rated movies | 9,724 |
| Mean ratings per user | 165.30 |
| Median ratings per user | 70.5 |
| Mean ratings per rated movie | 10.37 |
| Median ratings per rated movie | 3 |

The rating values observed in the initial audit occur in half-star increments. The follow-up validation cell checks the full observed value set explicitly.

### Sparsity

The matrix across 610 users and 9,724 rated movies has 5,931,640 possible user–movie pairs and 100,836 observed ratings. Observed density is 1.7000%; sparsity is 98.3000%.

### Genres, tags, and external identifiers

- Drama appears on 4,361 movies and Comedy on 3,756; 34 movies have no genre listed.
- Tags: 3,683 rows, 1,589 case-sensitive unique strings, 58 users supplying tags, and 1,572 distinct movies with tags.
- IMDb IDs are present in all 9,742 link rows; TMDB IDs are present in 9,734 rows.
- Rating timestamps range from 1996-03-29 18:36:55 UTC to 2018-09-24 14:27:30 UTC.
- Tag timestamps range from 2006-01-13 19:09:12 UTC to 2018-09-16 11:50:03 UTC.

## Decisions and modeling implications

1. Keep raw CSV files unchanged; record cleaning and feature transformations separately.
2. Do not drop catalog movies solely because a TMDB identifier is missing.
3. Begin content-based experiments with genres and title text. Tags can be an optional feature, but they do not cover the full catalog.
4. Compare simple popularity, content-based, and collaborative-filtering baselines rather than assuming a complex model is better.
5. Choose and document the evaluation split before model selection. Fit learned preprocessing only on training data and report cold-start/catalog coverage limitations.

## Limitations and cautions

- MovieLens is a research dataset and may not represent all movie viewers or current preferences.
- Ratings and tags are observed signals, not a complete or unbiased representation of taste.
- A random interaction split can obscure temporal effects or produce an evaluation setup that does not match the product use case.
- Review dataset terms and external metadata licensing before redistribution or commercial/revenue-generating use.

## Next actions

1. Keep the duplicate-pair and rating-scale checks in the audit workflow and rerun them if the source data changes.
2. Continue improving [Experiment 02 — Baseline Recommenders](02-baseline-recommenders.md), especially quantitative top-K ranking evaluation.
3. Revisit the findings if the local dataset version changes.
