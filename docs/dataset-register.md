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
| Dataset | Open Library Works, Authors, and Ratings monthly dumps |
| Provider | Internet Archive / Open Library |
| Official download and guidance | https://openlibrary.org/developers/dumps |
| Local expected path | User-selected directory outside the repository; pass paths to `backend/app/import_openlibrary.py` |
| Files | Works, Authors, and Ratings dumps, plain text or gzip |
| Role | Book metadata, Work IDs, and reader-rating aggregates used to rank selections |
| Retrieval method | Manual monthly bulk dumps; importer builds temporary SQLite indexes and scans the full Works dump |
| Selection | Highest reader-rating counts within selected subjects; default minimum 10 ratings and average 3.5/5; requires cover ID and author |
| Import limits | Default 500; maximum 5,000 selected works per run |
| Images | Displayed from Open Library's Covers host and linked to each Work record; images are not copied into Tastera |
| License/terms status | Follow dump-specific licenses and Open Library guidance; do not bulk crawl the Covers API. Review terms before redistribution or commercial use |
| Attribution | Imported rows cite Open Library; book cover links open the source Work record |
| Git policy | Dump files and temporary author index stay outside Git |

## Music catalog source: MusicBrainz core API

| Field | Record |
|---|---|
| Dataset | Release-group core metadata plus mapped positive-vote community genre tags |
| Provider | MetaBrainz Foundation / MusicBrainz |
| API | https://musicbrainz.org/doc/MusicBrainz_API |
| Retrieval method | Repeatable API importer in `backend/app/import_musicbrainz.py`; identifying User-Agent; minimum 1.1 seconds between requests |
| Role | Album title, artist credit, first release date, and release-group MBID |
| License/terms status | Core metadata is CC0; genre tags are supplementary data under CC BY-NC-SA 3.0, requiring attribution, non-commercial use, and share-alike treatment |
| Images | Front thumbnails are linked from Cover Art Archive and remain externally hosted; rights vary and are not granted by the metadata license |
| Attribution | Catalog cards link to the MusicBrainz release-group record; source metadata identifies the supplementary tag license when used |
| Git policy | No credentials required; no downloaded source files |

## Future candidate sources

Do not integrate these until intended use, licensing, attribution, API limits, and storage needs have been reviewed.

| Source | Potential role | Review before use |
|---|---|---|
| TMDB | Movie descriptions, genres, cast, release information and artwork metadata | API terms, attribution, commercial-use requirements, rate limits and caching rules |
| Open Library API | Interactive book lookup beyond the imported dump | API usage guidance; identify the application and cache appropriately; do not use it as a third-party catalog backend |
| Cover Art Archive | Music or release artwork | Use its hosted front thumbnails; image rights remain with their respective owners and separate permission may be required for reuse |

## Update protocol

For each new source, record the provider, exact dataset/version or access date, canonical URL, retrieval method, local path, schema, license/terms, attribution requirements, transformations, and whether redistribution or commercial use is permitted. Keep credentials and private tokens out of this file and out of Git.
