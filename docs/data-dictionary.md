# Data Dictionary

This document describes source fields in the MovieLens Latest Small archive used by TASTERA. It documents the source schema; it does not imply that preprocessing has already occurred.

## movies.csv

| Field | Meaning | Typical type | Notes |
|---|---|---|---|
| movieId | MovieLens identifier for a movie | Integer | Join key for ratings, tags and links |
| title | Movie title, commonly including release year in parentheses | String | Parse year only in a derived feature; preserve source title |
| genres | Pipe-separated genre labels | String | Split into a list or multi-hot features for modeling; preserve original value |

## ratings.csv

| Field | Meaning | Typical type | Notes |
|---|---|---|---|
| userId | MovieLens user identifier | Integer | Anonymized dataset identifier; not a real-world identity |
| movieId | Rated movie's MovieLens identifier | Integer | Should match the movie catalog |
| rating | Explicit rating recorded by a user | Float | Inspect observed scale and distribution before modeling |
| timestamp | Time at which the rating was recorded | Integer (Unix seconds) | Convert to UTC for analysis; consider temporal leakage when splitting data |

## tags.csv

| Field | Meaning | Typical type | Notes |
|---|---|---|---|
| userId | User who supplied the tag | Integer | Join key to ratings' user identifier namespace |
| movieId | Tagged movie's MovieLens identifier | Integer | Should match the movie catalog |
| tag | User-supplied descriptive text | String | May vary in spelling, case, specificity and frequency |
| timestamp | Time at which the tag was recorded | Integer (Unix seconds) | Convert to UTC for descriptive analysis |

## links.csv

| Field | Meaning | Typical type | Notes |
|---|---|---|---|
| movieId | MovieLens movie identifier | Integer | Join key to movies.csv |
| imdbId | IMDb identifier, stored in MovieLens' source format | Integer/string-like identifier | Preserve identifier formatting when constructing external URLs |
| tmdbId | The Movie Database identifier | Numeric with possible missing values | Initial audit: 8 of 9,742 values missing (0.0821%); treat as an identifier, not a measurement, and do not discard the movie solely because this external ID is absent |

## Derived fields planned for analysis

These are possible derived features, not columns in the original files.

| Derived feature | Source | Proposed transformation | Intended use |
|---|---|---|---|
| genre_list | movies.genres | Split on pipe separator | Genre analysis and content features |
| rating_datetime_utc | ratings.timestamp | Convert Unix seconds to UTC datetime | Temporal analysis and time-aware evaluation |
| ratings_per_user | ratings.userId | Count ratings by user | Activity distribution and split diagnostics |
| ratings_per_movie | ratings.movieId | Count ratings by movie | Popularity baseline and coverage analysis |
| tag_text_features | tags.tag | Documented text normalization and aggregation | Content-based experiments; initial audit found tags for 1,572 of 9,742 catalog movies (3,683 tag rows, 1,589 case-sensitive tag strings, 58 tag contributors) |
| movie_metadata_text | Titles, genres and tags | Explicitly documented combination | TF-IDF/content-based baseline |

## Data quality policy

- Initial MovieLens audit: no missing values in movies.csv, ratings.csv or tags.csv; 8 missing links.tmdbId values; no duplicate full rows; movie-ID joins were consistent with the catalog.
- Before modeling, separately validate duplicate (userId, movieId) rating pairs and observed rating values against the expected half-star scale; record the executed results.
- Measure missing values, duplicate rows, key uniqueness and join coverage before cleaning.
- Do not silently overwrite raw source fields.
- Document every removal, imputation, normalization or join in the notebook and reusable code.
- Treat IDs as identifiers, not continuous numeric features.
- Fit learned transformations only on the training split when required to avoid evaluation leakage.
- Update this dictionary when a source schema changes or derived fields become part of a stable pipeline.