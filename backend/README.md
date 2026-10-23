# TASTERA Backend

FastAPI service foundation for the TASTERA discovery platform.

## Current implementation

- `app/main.py`: creates the FastAPI application.
- `GET /health`: returns a lightweight service health response.
- `GET /api/v1/media`: lists the labeled development catalog with category, text,
  and pagination query parameters.
- `GET /api/v1/media/{media_id}`: returns one item by stable TASTERA ID.
- `POST /api/v1/auth/register` and `POST /api/v1/auth/login`: issue signed bearer sessions.
- `GET /api/v1/auth/me`: returns the signed-in account.
- `GET`, `PUT`, and `DELETE /api/v1/me/saved`: read and update that account's saved media.
- `GET /api/v1/me/recommendations`: ranks unsaved items by saved genres and explicit feedback.
- `PUT` and `DELETE /api/v1/me/recommendations/feedback/{media_id}`: save or clear a
  `more` / `less` recommendation signal for the signed-in account.
- `tests/test_health.py`: tests the health endpoint.

The catalog is stored in SQLite by default. Its schema also supports PostgreSQL
through `TASTERA_DATABASE_URL`. It includes an editorial development seed and a
repeatable TMDb popular-movie importer. Recommendation feedback is a simple
genre-weight signal, not a trained model. Ratings and password recovery are not
implemented yet. See
[project status](../docs/PROJECT_STATUS.md) and the [backend guide](../docs/backend.md).

## Requirements

Python and the packages in `requirements.txt`. A virtual environment is recommended.

## Run locally

From the repository root:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m alembic upgrade head
python -m app.seed_catalog
uvicorn app.main:app --reload
```

The default database is `backend/tastera.db` and is ignored by Git. To use
PostgreSQL, set `TASTERA_DATABASE_URL` before running Alembic, the seed command,
and the API, for example `postgresql+psycopg://user:password@host:5432/tastera`.

Open `http://127.0.0.1:8000/health` for the health check and `http://127.0.0.1:8000/docs` for interactive API documentation.

## Catalog API

```text
GET /api/v1/media?category=Movies&q=space&page=1&limit=20
GET /api/v1/media/interstellar
```

`category` accepts `Movies`, `Books`, or `Music`. `q` searches title, creator,
and genre without regard to case. Responses include deterministic pagination
fields (`items`, `page`, `limit`, `total`, and `total_pages`).

The local Vite origins on ports 5173 and 5174 may request the catalog by
default. For a deployed frontend, set `TASTERA_CORS_ORIGINS` to a comma-separated
list of its allowed origins, for example `https://tastera.example.com`.

The migrations create catalog tables plus `accounts`, `saved_media`, and
`recommendation_feedback`. Seed records use stable TASTERA IDs;
`python -m app.seed_catalog` is idempotent and only inserts missing records.
Apply pending schema changes with `python -m alembic upgrade head` before
running a catalog importer against that database.

## Accounts and saved items

Set `TASTERA_AUTH_SECRET` to a private random value of at least 32 characters
before enabling account registration or sign-in. Generate one locally with
`python -c "import secrets; print(secrets.token_urlsafe(48))"`, then add it as a
protected environment variable in the hosting service. Never commit or paste
the secret into chat. Passwords are hashed with Argon2; bearer sessions expire
after 12 hours. The frontend keeps the token in session storage, and saved media
is stored per account in PostgreSQL. Email verification, password recovery,
session revocation, and auth rate limiting are not implemented yet.

## Import movies from TMDb

The importer reads TMDb's popular movie pages, retrieves credits for director
metadata, and upserts each movie using its unique TMDb movie ID. It also matches
an existing editorial seed by exact normalized title and creator to avoid
duplicating those seed items. Each run reports added, updated, and skipped
records; it can safely be rerun to refresh metadata.

Request a TMDb API Read Access Token in your TMDb account settings and set it
only in the local environment (do not commit it):

```powershell
$env:TMDB_READ_ACCESS_TOKEN = "your-read-access-token"
python -m app.import_tmdb --pages 5
```

Each popular page contains up to 20 movies. The importer waits between movie
credit requests and retries temporary rate-limit/server errors. Options include
`--pages` (1–500), `--language` (default `en-US`), and `--request-delay`
(default `0.25` seconds). The first import can add up to 100 movies with the
example command. Run it again to update matching records without duplicates.

TMDb requires attribution for non-commercial API use. The frontend includes the
required notice: “This product uses the TMDB API but is not endorsed or
certified by TMDB.” Review TMDb's current [API terms and FAQ](https://developer.themoviedb.org/docs/faq)
before public or commercial use.

## Import books from Open Library

For a repeatable bulk import, download the monthly Works, Authors, and Ratings dumps from
the [Open Library data dumps page](https://openlibrary.org/developers/dumps).
Keep the source files outside Git. The importer indexes ratings, scans the
entire Works dump, and selects the highest-rated matching works with at least
10 reader ratings and a 3.5/5 average. It no longer takes the first rows from
the lexically ordered dump. It links covers from Open Library's Covers service
using Work cover IDs and links each displayed cover back to its Open Library
record. The image stays hosted by Open Library.

```powershell
python -m app.import_openlibrary `
  --works "..\data\New folder\ol_dump_works_2026-09-30.txt.gz" `
  --authors "..\data\New folder\ol_dump_authors_2026-09-30.txt.gz" `
  --ratings "..\data\New folder\ol_dump_ratings_2026-09-30.txt.gz" `
  --limit 500 `
  --prune-unselected
```

Download the Ratings dump into the same local folder first; the two dumps
already downloaded are not enough to rank works by actual user ratings.
`--limit` chooses the highest-rated 1–5000 matching works. `--minimum-ratings`
and `--minimum-average` can adjust the quality threshold. `--prune-unselected`
removes older imported Open Library works outside the selected set while
preserving any item saved or feedback-rated by an account. Keep the dumps out of
Git and retain Open Library attribution. Open Library asks sites to display
covers directly from `covers.openlibrary.org`, avoid bulk crawling its Covers
API, and link back to Open Library; see its [cover guidance](https://openlibrary.org/dev/docs/api/covers)
and [data guidance](https://openlibrary.org/developers) before redistribution
or commercial use.

## Import popular music albums with covers

The default importer combines MusicBrainz searches across common genres,
deduplicates release groups, and ranks candidates by community tag votes as a
rough popularity signal. It checks Cover Art Archive metadata and imports only
albums with a confirmed front-cover image, up to 500. This is a community-data
popularity proxy, not a chart or sales ranking; a run can return fewer than 500
if its searches do not find enough well-tagged albums with cover art. It no
longer treats the first two pages of a generic album query as a useful catalog.

```powershell
python -m app.import_musicbrainz --limit 500 --prune-unselected
```

`--prune-unselected` removes older MusicBrainz imports outside the newly selected
covered set, while preserving records saved or feedback-rated by an account.
Omit it to leave existing catalog rows in place. `--query` is available for a
one-off targeted search; the default genre searches provide wider coverage.
The importer uses an identifying User-Agent and spaces MusicBrainz queries by at
least 1.1 seconds. It reports candidate, verified-cover, selected, added,
updated, and skipped counts.

See the [MusicBrainz API](https://musicbrainz.org/doc/MusicBrainz_API),
[rate limit](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting),
[data license](https://musicbrainz.org/doc/About/Data_License), and
[Cover Art Archive API](https://musicbrainz.org/doc/Cover_Art_Archive/API).
MusicBrainz core metadata is CC0; supplementary tags require attribution and
non-commercial share-alike treatment. Cover-art rights vary by image, so do not
assume Cover Art Archive images are freely licensed for redistribution or
commercial use.

## Test

With the virtual environment active and current directory set to `backend/`:

```powershell
pytest
```

## Compare recommendation strategies on app signals

With a migrated database containing account saves and recommendation feedback,
run this read-only leave-last-20%-out comparison from `backend/`:

```powershell
python -m app.evaluate_recommendations --category Movies --k 12
python -m app.evaluate_recommendations --category all --k 12
```

It compares the movie genre baseline and co-save item-item ranker using Hit
Rate@K, Recall@K, NDCG@K, catalog coverage, and intra-list genre diversity.
Books and Music are measured with the genre baseline until their own interaction
data supports separate models. At least five accounts with three or more
positive items per category are required before metrics are reported. Saves and
“More like this” are treated as positive outcomes; “Not for me” removes items
from candidates. Because the app does not yet log recommendation impressions,
these are interaction-based proxy metrics, not impression-aware online metrics.
The command prints an insufficient-data status instead of a score when the
minimum cohort is unavailable.

## Development conventions

- Add product endpoints under a versioned prefix such as `/api/v1`.
- Use Pydantic schemas for request and response validation.
- Keep business logic in services rather than route handlers.
- Add tests with each endpoint.
- Never commit secrets or production environment files.
