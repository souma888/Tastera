# TASTERA Project Status

**Last reviewed:** 2026-10-18
**Status:** Deployed catalog foundation; account-backed Library is implemented locally and awaits deployment configuration.
**Scope:** Cross-media discovery across movies, books, music, and potential future categories.

## Implemented

### Frontend

- React, TypeScript, and Vite application under `frontend/`.
- Discover loads catalog results from the FastAPI API with search, categories, and pagination; six local items remain as an offline fallback.
- Reusable media cards, poster fallback art, and a fixed Taste Map prototype.
- Account registration/sign-in screens and account-backed Library UI. The bearer token is held in browser session storage.

### Backend and data

- FastAPI catalog API, SQLAlchemy models, and Alembic migrations.
- Local SQLite by default; deployed API uses Neon PostgreSQL through `TASTERA_DATABASE_URL`.
- TMDb popular-movie importer with provider-ID upserts.
- Argon2 password hashing, signed bearer sessions, and account-scoped saved-item list/save/remove endpoints.

### Research

- MovieLens audit and baseline recommendation notebooks and documented experiment notes.
- Reusable popularity and genre-overlap baseline classes under `src/tastera/recommenders/`.

## Current limitations and deployment steps

- Configure a private `TASTERA_AUTH_SECRET` in Render before account endpoints can issue or validate sessions. Deploying the new migration also requires the current Render start command to run `python -m alembic upgrade head`.
- The account flow has no email verification, password recovery, session revocation, or rate limiting yet.
- Ratings and likes are not stored; only saved items currently contribute user state.
- The Profile and Taste Map are still prototypes. The Taste Map remains fixed demo data and has a known duplicate-looking edge issue.
- TMDb ingestion is manual and movie-only. Books and music remain editorial starter records; there is no scheduled/monitored ingestion yet.
- Recommendation baselines are research code, not deployed personalized or cross-media recommendations.
- The MovieLens notebooks should be rerun locally before treating their results as freshly reproduced.

## Recommended next milestones

1. Set `TASTERA_AUTH_SECRET` in Render, deploy the account migration, and verify sign-up/sign-in plus save/remove on the production domain.
2. Add likes or ratings after the account-backed Library is confirmed in production.
3. Serve a simple recommendation baseline through the API, then evaluate relevance and catalog coverage.
4. Expand Books and Music from approved metadata sources and make ingestion observable and repeatable.
5. Replace the demo Taste Map with evidence-backed catalog/user relationships.

See [architecture](architecture.md), [backend guide](backend.md), [ML roadmap](ml-roadmap.md), and [implementation roadmap](roadmap.md).
