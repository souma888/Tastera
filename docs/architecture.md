# TASTERA Architecture

**Reviewed:** 2026-10-18. This describes the current deployed product and separates implemented behavior from future direction.

## Current system

```text
Browser
  └── React + TypeScript + Vite (Vercel)
        ├── catalog, account, saved-media, recommendation API clients
        ├── sessionStorage bearer token
        └── six-item fallback catalog when API is unavailable
              │ HTTPS
              ▼
        FastAPI (Render)
          ├── /api/v1/media             catalog/search/detail
          ├── /api/v1/auth              register/login/current account
          ├── /api/v1/me/saved          account-scoped library
          └── /api/v1/me/recommendations genre baseline and feedback
              │ SQLAlchemy + Alembic
              ▼
        Neon PostgreSQL (production)
        SQLite (local default)
```

Offline research is separate from request-time recommendations:

```text
MovieLens data (local only) → audit/baseline notebooks → research notes
TMDb popular movies → manual importer → catalog database
```

The frontend is deployed at [soumadip-tastera.vercel.app](https://soumadip-tastera.vercel.app), and the API at [tastera.onrender.com](https://tastera.onrender.com). Deployment environment variables and hosting configuration are managed by the service dashboards; do not infer secrets or values from this document.

## Implemented data and behavior

- SQLAlchemy catalog records support Movies, Books, and Music; the TMDb importer currently handles popular movies and is run manually.
- Alembic migrations manage the catalog, `accounts`, `saved_media`, and `recommendation_feedback` tables.
- Passwords are hashed with Argon2. Signed bearer tokens expire after 12 hours; the browser stores them in session storage.
- Saved items and recommendation feedback are scoped to the authenticated account.
- Recommendations score catalog candidates using saved genres and persisted “more”/“less” signals. This is a simple, transparent baseline; it has not been established as a trained or evaluated ML model.
- Profile and Taste Map do not yet reflect a complete live user model; the graph is prototype data.

## Request flow

1. The browser calls the versioned FastAPI API. Discover requests catalog data; account views send a bearer token.
2. FastAPI validates requests and derives the account from the validated token for private endpoints.
3. SQLAlchemy reads or writes the configured database. Alembic controls schema changes.
4. The API returns data for the frontend to render. The frontend can use its small fallback catalog for catalog browsing if API loading fails; private features require a working API and account session.

## Security and operations

- Configure `TASTERA_DATABASE_URL`, `TASTERA_AUTH_SECRET`, and `TASTERA_CORS_ORIGINS` in the backend host. Never place backend secrets in `VITE_*` variables or Git.
- Use HTTPS and limit CORS to trusted frontend origins in deployment.
- Current account limitations include no email verification, password recovery, session revocation, or authentication rate limiting.
- A manual TMDb import is not a scheduled or monitored ingestion pipeline. Books and Music need broader reviewed sources and coverage.

## Direction

The next product work is data-backed Profile, better Books/Music coverage, and a For You refresh action. Later work can make the Taste Map evidence-based, improve recommendation evaluation and diversity, and automate catalog ingestion. Add vector search, graph infrastructure, or a trained model only when the data and measured need support them.

See [backend guide](backend.md), [frontend guide](frontend.md), and [project status](PROJECT_STATUS.md).
