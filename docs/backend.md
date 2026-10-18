# Backend Guide

## Current status

The FastAPI backend exposes `GET /health` and a database-backed catalog API at `/api/v1/media`. SQLAlchemy models and an Alembic migration define media items, source identifiers, normalized genres, and media-genre links. A repeatable TMDb popular-movie importer is available; authentication, user interactions, scheduled ingestion, and recommendation inference are not implemented.

## Local setup

From the repository root, use a supported Python version and create a virtual environment:

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

SQLite is used by default at `backend/tastera.db`. Set `TASTERA_DATABASE_URL`
before migration, seeding, and startup to use PostgreSQL. The seed command is
safe to rerun; it adds missing records and synchronizes known ISBN identifiers.

## Import popular movies from TMDb

Set a TMDb API Read Access Token in `TMDB_READ_ACCESS_TOKEN`, then run from
`backend/`:

```powershell
$env:TMDB_READ_ACCESS_TOKEN = "your-read-access-token"
python -m app.import_tmdb --pages 5
```

This imports up to 100 movies per invocation (20 per page), fetches director
credits, and upserts by unique TMDb movie ID. Repeat the command to refresh
metadata. Use `--pages`, `--language`, and `--request-delay` to adjust the run.
The token stays in the environment and must not be committed. Consult TMDb's
[API terms and FAQ](https://developer.themoviedb.org/docs/faq); non-commercial
use requires attribution, which the frontend displays.

If PowerShell blocks virtual-environment activation, use Command Prompt activation or the appropriate session-only execution-policy workaround. Run commands from `backend/` so that `app.main:app` resolves.

- Health check: `http://127.0.0.1:8000/health`
- Interactive API documentation: `http://127.0.0.1:8000/docs`
- OpenAPI schema: `http://127.0.0.1:8000/openapi.json`

## Tests

From `backend/` with the virtual environment active:

```powershell
pytest
```

The test suite is small at this stage. Add tests for validation, error cases, database behavior, permissions, and recommendation contracts as those components are implemented.

## Recommended structure

```text
backend/app/
├── main.py
├── api/v1/          # HTTP route handlers
├── core/            # settings, security, shared configuration
├── models/          # database models
├── schemas/         # request/response validation schemas
├── services/        # application/business logic
└── recommender/     # inference adapters, not training notebooks
```

`api/v1/`, `core/`, `models/`, `schemas/`, and `services/` contain the initial
catalog implementation. Security and recommendation modules remain future work.

## API conventions

- Use a versioned prefix such as `/api/v1` for application endpoints.
- Keep health checks separate from product API routes.
- Validate incoming values with Pydantic schemas.
- Use pagination and deterministic ordering for catalog endpoints.
- Return consistent errors and never expose internal tracebacks or secrets.
- Add explicit tests for invalid parameters and missing records.
- Once accounts exist, derive the acting user from validated authentication, not from a user ID supplied by the client.
- Configure allowed CORS origins explicitly for deployment.

## Catalog endpoint

The current paginated catalog endpoint supports:

```http
GET /api/v1/media?category=Movies&q=space&page=1&limit=20
```

`category` accepts `Movies`, `Books`, or `Music`; `q` searches title, creator,
and primary genre. Results have deterministic title/ID ordering and return
`items`, `page`, `limit`, `total`, and `total_pages`. Limits range from 1 to 50.
The Discover page exposes Previous/Next controls when multiple pages are
available.

## Configuration and secrets

Use `TASTERA_DATABASE_URL` for the database and `TASTERA_CORS_ORIGINS` for
comma-separated allowed browser origins. Do not commit database passwords,
tokens, private datasets, or production environment files.
