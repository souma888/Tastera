# Backend Guide

## Current status

The FastAPI service is deployed at [tastera.onrender.com](https://tastera.onrender.com); interactive API documentation is available at [/docs](https://tastera.onrender.com/docs). It provides catalog, account, saved-media, and recommendation endpoints. Production uses Neon PostgreSQL; local development uses SQLite by default.

Recommendations use saved genres and persisted per-account `more`/`less` signals to adjust genre weights. This is a transparent baseline, not a trained or evaluated model. TMDb movie import is manual; scheduled ingestion and ratings are not implemented.

## Local setup

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

SQLite is stored at `backend/tastera.db`. Set `TASTERA_DATABASE_URL` before migrations, seeding, and startup to use PostgreSQL. The seed is safe to rerun. Set a private `TASTERA_AUTH_SECRET` to enable account registration/sign-in and `TASTERA_CORS_ORIGINS` to the allowed browser origins. Keep these in the environment, never in Git or frontend variables.

- Health check: `http://127.0.0.1:8000/health`
- API docs: `http://127.0.0.1:8000/docs`
- OpenAPI schema: `http://127.0.0.1:8000/openapi.json`

## API surface

Routes use the `/api/v1` prefix. Private endpoints require `Authorization: Bearer <token>`.

| Method and path | Purpose |
|---|---|
| `GET /media?category=&q=&page=&limit=` | Search and paginate Movies, Books, or Music |
| `GET /media/{media_id}` | Fetch a catalog item |
| `POST /auth/register` | Register and issue a signed token |
| `POST /auth/login` | Sign in and issue a signed token |
| `GET /auth/me` | Return the signed-in account |
| `GET /me/saved` | Read saved media for the account |
| `PUT /me/saved/{media_id}` | Save an item |
| `DELETE /me/saved/{media_id}` | Unsave an item |
| `GET /me/recommendations?category=&limit=` | Get genre-weighted recommendations |
| `PUT /me/recommendations/feedback/{media_id}` | Store `more` or `less` feedback |
| `DELETE /me/recommendations/feedback/{media_id}` | Clear feedback for an item |

The generated `/docs` page is the source of truth for request/response schemas and status codes. Catalog pagination returns `items`, `page`, `limit`, `total`, and `total_pages`; the API currently caps page size at 50. Recommendation `limit` is capped at 20.

## Import movies from TMDb

Set `TMDB_READ_ACCESS_TOKEN` only in the local shell, then run from `backend/`:

```powershell
$env:TMDB_READ_ACCESS_TOKEN = "your-read-access-token"
python -m app.import_tmdb --pages 5
```

The command imports up to 20 popular movies per page, fetches director credits, and upserts using TMDb IDs. It can be rerun to refresh records. Options include `--pages`, `--language`, and `--request-delay`. The token is only needed for imports, not normal app use; never commit it.

Review TMDb's [API terms and FAQ](https://developer.themoviedb.org/docs/faq). Non-commercial use has attribution requirements; the frontend displays the attribution notice.

## Authentication and limitations

Passwords are hashed with Argon2. Signed bearer tokens expire after 12 hours, and the frontend stores them in session storage. The current implementation does not include email verification, password recovery, session revocation, or authentication rate limiting. Account and recommendation flows need broader automated coverage; see [project status](PROJECT_STATUS.md).

## Tests

From `backend/` with its virtual environment active:

```powershell
pytest
```

Do not describe unrun tests as passing. Add coverage for validation, database/migration behavior, account isolation, saved items, and feedback as those areas change.
