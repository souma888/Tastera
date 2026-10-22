# Dataset Register

This register records dataset provenance, intended use, access method, and known restrictions for TASTERA. Update it whenever a dataset version, source, license, or access method changes.

## MovieLens Latest Small

| Field | Record |
|---|---|
| Dataset | MovieLens Latest Small (ml-latest-small) |
| Provider | GroupLens Research, University of Minnesota |
| Official download | https://files.grouplens.org/datasets/movielens/ml-latest-small.zip |
| Dataset README | https://files.grouplens.org/datasets/movielens/ml-latest-small-README.html |
| Local expected path | data/raw/movielens/ml-latest-small/ |
| Files | movies.csv, ratings.csv, tags.csv, links.csv |
| Initial role | Movie catalog, ratings-based experiments, tags, external identifier mapping |
| Version recorded | Latest Small archive downloaded for this project; record the download date and archive checksum locally when known |
| License/terms status | Review the included README and current GroupLens terms before redistribution or commercial/revenue-generating use. Do not assume that public download means unrestricted commercial permission. |
| Git policy | Keep raw files out of Git; preserve the downloaded source files unchanged locally. |

### Files and fields

- movies.csv: movieId, title, genres
- ratings.csv: userId, movieId, rating, timestamp
- tags.csv: userId, movieId, tag, timestamp
- links.csv: movieId, imdbId, tmdbId

### Initial local inventory

The initial terminal inspection reported:

| File | Rows | Columns |
|---|---:|---:|
| movies.csv | 9,742 | 3 |
| ratings.csv | 100,836 | 4 |
| tags.csv | 3,683 | 4 |
| links.csv | 9,742 | 3 |

The user's successful local audit notebook run reproduced these dimensions. The same run found no duplicate full rows, no movie-ID references outside the catalog, and no missing values in movies.csv, ratings.csv, or tags.csv. The links.csv file has 8 missing tmdbId values (0.0821%) and complete imdbId coverage.

### Observed coverage notes

- Ratings cover 9,724 distinct movies; tags cover 1,572 distinct movies.
- The tags file has 3,683 records, 1,589 case-sensitive unique tag strings, and 58 tag contributors.
- The observed user–movie rating matrix is 98.3000% sparse (610 users, 9,724 rated movies, 100,836 observed ratings).
- The audit's follow-up duplicate (userId, movieId) and rating-scale validation must be run and reviewed before modeling decisions are finalized.
- Re-run notebooks/01_dataset_audit.ipynb whenever the local dataset changes and keep conclusions tied to the executed version.

## Book catalog source: Open Library monthly dumps

| Field | Record |
|---|---|
| Dataset | Open Library Works and Authors monthly dumps |
| Provider | Internet Archive / Open Library |
| Official download and guidance | https://openlibrary.org/developers/dumps |
| Local expected path | User-selected directory outside the repository; pass paths to `backend/app/import_openlibrary.py` |
| Files | Works dump and Authors dump, plain text or gzip |
| Role | Book titles, authors, descriptions, subjects, and stable Work identifiers |
| Retrieval method | Manual download of monthly bulk dumps; importer streams them and builds a temporary SQLite author lookup |
| Import limits | Default 500; maximum 5,000 added or updated records per run; subject filtered |
| Images | No cover images imported; rights not established for catalog reuse |
| License/terms status | Open Library recommends monthly dumps for bulk use and asks applications to follow its data guidance; check current dump licensing before redistribution or commercial use |
| Attribution | Source is recorded as Open Library in imported catalog rows; keep provider attribution with redistributed data |
| Git policy | Dump files and temporary author index stay outside Git |

## Music catalog source: MusicBrainz core API

| Field | Record |
|---|---|
| Dataset | Release-group search results (core metadata only) |
| Provider | MetaBrainz Foundation / MusicBrainz |
| API | https://musicbrainz.org/doc/MusicBrainz_API |
| Retrieval method | Repeatable API importer in `backend/app/import_musicbrainz.py`; identifying User-Agent; minimum 1.1 seconds between requests |
| Role | Album title, artist credit, first release date, and release-group MBID |
| License/terms status | Core metadata is CC0. Supplementary tags/genres have separate CC BY-NC-SA terms and are excluded |
| Images | Cover Art Archive images are not imported; artwork rights remain with owners |
| Attribution | Imported rows identify MusicBrainz core as the source |
| Git policy | No credentials required; no downloaded source files |

## Future candidate sources

Do not integrate these until intended use, licensing, attribution, API limits, and storage needs have been reviewed.

| Source | Potential role | Review before use |
|---|---|---|
| TMDB | Movie descriptions, genres, cast, release information and artwork metadata | API terms, attribution, commercial-use requirements, rate limits and caching rules |
| Open Library API | Interactive book lookup beyond the imported dump | API usage guidance; identify the application and cache appropriately; do not use it as a third-party catalog backend |
| Cover Art Archive | Music or release artwork | Image rights remain with their respective owners; obtain rights before reuse |

## Update protocol

For each new source, record the provider, exact dataset/version or access date, canonical URL, retrieval method, local path, schema, license/terms, attribution requirements, transformations, and whether redistribution or commercial use is permitted. Keep credentials and private tokens out of this file and out of Git.
