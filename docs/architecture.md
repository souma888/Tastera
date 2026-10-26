# TASTERA Architecture

**Reviewed:** 2026-10-26. This document describes deployed product behavior and separates catalog evidence, semantic inference, and personalized recommendation.

## Runtime system

```text
Browser
  └── React + TypeScript + Vite (Vercel)
        ├── catalog, account, saved-media, and recommendation clients
        ├── semantic search and aggregate evaluation dashboard
        ├── Connection Explorer (creator, genre, editorial-theme evidence)
        ├── user-data Taste Map and Profile
        ├── browser session token and local settings/collections
        └── six-record offline fallback catalog
              │ HTTPS
              ▼
        FastAPI (Render)
          ├── /api/v1/media             search and pagination (up to 150/page)
          ├── /api/v1/media/semantic    Sentence Transformer + pgvector search
          ├── /api/v1/ai                authenticated evidence-grounded wording
          ├── /api/v1/evaluation        aggregate offline model metrics
          ├── /api/v1/auth              register/login/current account
          ├── /api/v1/me/saved          account-scoped Library
          └── /api/v1/me/recommendations ranking and feedback
              │ SQLAlchemy + Alembic
              ▼
        Neon PostgreSQL (production, with pgvector catalog embeddings)
        SQLite (local default)
```

The application code now includes semantic retrieval, ML Lab evaluation, and authenticated evidence phrasing. Production semantic retrieval requires migration `20261026_08` followed by `python -m app.embed_catalog`; this repository change alone does not apply the live database migration or configure an OpenAI secret.

Offline catalog import and MovieLens research are separate from request-time inference:

```text
TMDb popular movies ─┐
Open Library works ──┼── manual import commands ──> catalog database
MusicBrainz albums ──┘
MovieLens data (local only) ──> research notebooks and evaluation notes
```

The canonical frontend is [soumadip-tastera.vercel.app](https://soumadip-tastera.vercel.app); the API is [tastera.onrender.com](https://tastera.onrender.com). In production the browser calls the same-origin `/api/v1` route and Vercel rewrites it to Render (`frontend/vercel.json`). Local development can set `VITE_API_BASE_URL` to the local API. Hosting credentials and environment variables are configured in provider dashboards and are never stored in these docs.

## Catalog and pathway flow

1. Discover calls `GET /api/v1/media` with category, search text, page, and page size. Text search matches title, creator, and genre; rows are ordered by source popularity.
2. Opening an item starts the Connection Explorer. It queries the same catalog API by genre and creator, combines results with the currently loaded catalog, then matches exact normalized genre tags, creator credits, and eligible editorial-theme terms.
3. The UI labels the evidence type and separately marks saved/feedback activity. Creator pages reuse creator search and retain exact normalized credit matching.
4. Taste Map uses account saves and feedback as nodes and shared catalog genres as the graph's relationship nodes. Selecting a genre exposes matching catalog items; selecting an item exposes related records from the catalog currently loaded in the client.

Semantic search encodes the query and catalog metadata with the same 384-dimensional Sentence Transformer, then orders matching records by pgvector cosine similarity. A manual `python -m app.embed_catalog` job creates or refreshes item vectors after imports or metadata changes. These matches are labeled as model inference, not factual relationships. The evaluation API exposes aggregate offline results only after its minimum cohort is met. Optional explanation wording is authenticated and runs only when an OpenAI key is configured; structured evidence remains the source of truth.

The app has no persisted relationship graph or separate creator/theme endpoint. Setting and influence metadata are not consistently available. Editorial note overlap is an interpretation, not a verified external fact. No link is presented as proof of preference.

## Accounts and recommendations

- Passwords use Argon2 and signed bearer tokens expire after 12 hours. The browser holds the token in session storage.
- Saved items and feedback are scoped to the authenticated account.
- The frontend caches the signed-in account and that account's Library snapshot in `sessionStorage`. Temporary network/server failures preserve the cache and offer manual refresh; a confirmed `401` clears the session and asks the user to sign in. The cache is a recovery aid, not the source of truth. Account mutations are not automatically retried.
- For You uses saved genres, onboarding preferences, explicit `more`/`less` feedback, category mix, and popularity. Movie item-item co-save similarity is used when available. This is a transparent baseline, not a trained and validated multi-category model.
- Profile counts and summarizes account saves and recommendation feedback. Onboarding choices, recommendation mix/strategy, and collections are browser-local.

## Security and operations

- Configure `TASTERA_DATABASE_URL`, `TASTERA_AUTH_SECRET`, and `TASTERA_CORS_ORIGINS` in the backend host. Never put these in Vite variables or Git.
- The account system still lacks email verification, password recovery, session revocation, and authentication rate limiting.
- Catalog imports are manual. Monitoring, automated scheduling, and a complete backup/restore and rollback runbook remain open.
- Provider terms and attribution differ by source. See the [dataset register](dataset-register.md).

See [backend guide](backend.md), [frontend guide](frontend.md), [project status](PROJECT_STATUS.md), and [ML roadmap](ml-roadmap.md).
