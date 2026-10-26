# TASTERA Backend

FastAPI service foundation for the TASTERA discovery platform.

## Current implementation

- `app/main.py`: creates the FastAPI application.
- `GET /health`: returns a lightweight service health response.
- `GET /api/v1/media`: lists the labeled development catalog with category, text,
  and pagination query parameters.
- `GET /api/v1/media/semantic`: retrieves catalog items by natural-language meaning with Sentence Transformer embeddings stored in PostgreSQL/pgvector.
- `GET /api/v1/media/{media_id}`: returns one item by stable TASTERA ID.
- `POST /api/v1/auth/register` and `POST /api/v1/auth/login`: issue signed bearer sessions.
- `GET /api/v1/auth/me`: returns the signed-in account.
- `GET /api/v1/auth/me/export` and `DELETE /api/v1/auth/me`: export or permanently delete server-stored personal data.
- `GET /api/v1/me/saved`: list that account's Library entries and personal metadata.
- `PUT` / `DELETE /api/v1/me/saved/{media_id}`: add or remove a Library entry.
- `PATCH /api/v1/me/saved/{media_id}`: update status, personal rating, private note, or progress.
- `GET /api/v1/me/saved/activity`: list recent account-scoped Library history.
- `GET /api/v1/me/recommendations`: ranks unsaved items by saved genres and explicit feedback.
- Catalog search and creator/theme exploration reuse `GET /api/v1/media`; there is no separate cross-media relationship endpoint. The frontend compares normalized creator credits and genre tags and labels editorial and user-activity signals separately.
- `PUT` and `DELETE /api/v1/me/recommendations/feedback/{media_id}`: save or clear a
  `more` / `less` recommendation signal for the signed-in account.
- `POST /api/v1/ai/connection-explanation`: phrases server-computed catalog evidence with the optional OpenAI Responses API for a signed-in account.
- `GET /api/v1/evaluation/recommendations`: returns aggregate-only offline recommender metrics for the ML Lab dashboard.
- `tests/test_health.py`: tests the health endpoint.
- `tests/test_saved_response.py`: verifies saved Library responses use the saved-record `updated_at` timestamp rather than duplicating the catalog field.

The catalog is stored in SQLite by default. Its schema also supports PostgreSQL
through `TASTERA_DATABASE_URL`. It includes repeatable TMDb, Open Library, and
MusicBrainz importers. Catalog page size is capped at 150; unartworked Music
records are excluded from catalog browse results. Recommendation feedback is a
transparent baseline signal, not a trained cross-media model. Personal ratings
affect the account's genre and movie similarity ranking; notes are private
context and are not analyzed. Saved Library response serialization merges catalog fields before applying saved-record metadata, so the saved record's `updated_at` takes precedence. See
[project status](../docs/PROJECT_STATUS.md) and the [backend guide](../docs/backend.md).

Semantic retrieval uses `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions)
and PostgreSQL `pgvector`. SQLite remains suitable for ordinary local app work,
but semantic queries require PostgreSQL. The model loads lazily on first use and
runs on CPU; allow sufficient memory and initial model download time on the API host.

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
After deploying a backend release with a new migration, run `python -m alembic upgrade head`
from `backend` with `PYTHONPATH` set to that directory and `TASTERA_DATABASE_URL`
pointing to the hosted database. The Render start command does not run migrations.

Open `http://127.0.0.1:8000/health` for the health check and `http://127.0.0.1:8000/docs` for interactive API documentation.

## Catalog API

```text
GET /api/v1/media?category=Movies&q=space&page=1&limit=20
GET /api/v1/media/interstellar
```

`category` accepts `Movies`, `Books`, or `Music`. `q` searches title, creator,
and genre without regard to case. Unfiltered results are ordered by a normalized
source popularity signal: TMDb popularity for movies, reader-rating counts for
books, and positive community-tag counts for music. These signals help surface
better-known items but are not a single cross-media chart. Responses include
deterministic pagination fields (`items`, `page`, `limit`, `total`, and
`total_pages`).

The local Vite origins on ports 5173 and 5174 may request the catalog by
default. For a deployed frontend, set `TASTERA_CORS_ORIGINS` to a comma-separated
list of its allowed origins, for example `https://tastera.example.com`.

The migrations create catalog tables plus `accounts`, `saved_media`, and
`recommendation_feedback`. Seed records use stable TASTERA IDs;
`python -m app.seed_catalog` is idempotent and only inserts missing records.
Apply pending schema changes with `python -m alembic upgrade head` before
running a catalog importer against that database. The popularity score
migration adds the catalog sort field; rerun each catalog importer to refresh
scores on records that were imported before the field existed.

### Semantic search and embeddings

After deploying a release that contains migration `20261026_08`, run the normal
Alembic upgrade against PostgreSQL (use the direct/unpooled migration URL where
available), then create or refresh catalog vectors from `backend/`:

```powershell
python -m alembic upgrade head
python -m app.embed_catalog
```

The embedding command is repeatable: it skips unchanged catalog text and
re-embeds records when title, creator, category, genres, description, or model
version changes. Use `--force` to rebuild all vectors. Re-run it after imports
or material catalog edits. SQLite migration uses JSON so the app remains
usable, but nearest-neighbor retrieval is PostgreSQL-only. PostgreSQL migration
enables `pgvector` and creates a cosine HNSW index.

Natural-language search uses `GET /api/v1/media/semantic?q=...&category=...`.
The Discover search box's **AI** toggle switches from keyword matching to
semantic retrieval. Connection Explorer marks semantic pathways as model
inference, not factual links or predictions of personal preference.

### Grounded AI wording

Set `OPENAI_API_KEY` and optionally `TASTERA_EXPLANATION_MODEL` in the backend
host's protected environment settings to enable generated wording. The default
model is `gpt-4.1-mini`. Keep the key out of Vercel frontend variables and Git.
The authenticated request is user-triggered and sends only catalog titles,
categories, and server-computed evidence. Exact structured evidence remains
separate in the response as the source of truth. If the provider is not
configured or fails, the API returns a deterministic evidence-grounded sentence.

### Evaluation dashboard

Open **ML Lab** in the app to compare Precision@K and catalog coverage for the
genre baseline, movie item-item ranker, and embedding profile. The scorecard
also includes Recall@K, NDCG@K, and intra-list diversity. The app hides metrics
until at least five accounts meet the existing minimum-history cohort. These are
offline interaction-based proxy metrics, not impression-aware online results.
The endpoint returns aggregate scores only, never account-level rows.

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
