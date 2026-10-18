# TASTERA Project Status

**Last reviewed:** 2026-10-18
**Status:** Production app is live with an account-backed Library and a genre-based recommendation flow with persisted feedback.
**Scope:** Cross-media discovery across movies, books, music, and potential future categories.

## User-requested next product changes

- Finish the Profile section so it becomes a useful, data-backed view of the user's taste and activity instead of a placeholder.
- Expand the Books and Music catalog; these categories still have too little content.
- Add a refresh control beside the For You recommendations so users can request another batch, especially more movie recommendations, without losing their saved items or feedback.

These priorities were confirmed by the user on 2026-10-18. Update this list as each item is implemented.

## Implemented

### Frontend

- React, TypeScript, and Vite application under `frontend/`.
- Discover loads catalog results from the FastAPI API with search, categories, and pagination; six local items remain as an offline fallback.
- Reusable media cards, poster fallback art, and a fixed Taste Map prototype.
- Account registration/sign-in screens, account-backed Library UI, For You recommendations, and More like this / Not for me controls. The bearer token is held in browser session storage.

### Backend and data

- FastAPI catalog API, SQLAlchemy models, and Alembic migrations.
- Local SQLite by default; deployed API uses Neon PostgreSQL through `TASTERA_DATABASE_URL`.
- TMDb popular-movie importer with provider-ID upserts.
- Argon2 password hashing, signed bearer sessions, account-scoped saved-item endpoints, genre-based recommendations, and persisted recommendation feedback.

### Research

- MovieLens audit and baseline recommendation notebooks and documented experiment notes.
- Reusable popularity and genre-overlap baseline classes under `src/tastera/recommenders/`.

## Current gaps

- Verify the complete feedback-and-undo flow against production account data; its routes and production deployment are live.
- Add backend tests for authentication, account isolation, saved items, recommendation ranking, feedback, and migration behavior. Production deployment is live; this documentation update did not run application checks.
- The account flow has no email verification, password recovery, session revocation, or rate limiting yet.
- The Profile is still a placeholder. The Taste Map remains fixed demo data and has a known duplicate-looking edge issue.
- Books and Music have limited catalog coverage. TMDb ingestion is manual and movie-only; scheduled and monitored ingestion is not implemented.
- Recommendations are a transparent genre-weighting baseline with user feedback, not a trained or evaluated recommendation model.
- The MovieLens notebooks should be rerun locally before treating their results as freshly reproduced.

## Recommended next milestones

1. Complete the Profile section with data-backed taste and activity information.
2. Expand Books and Music catalog coverage from reviewed metadata sources.
3. Add a refresh control beside For You to request another recommendation batch, particularly movies.
4. Verify the deployed recommendation feedback flow, then add backend and end-to-end tests.
5. Reproduce and evaluate the recommendation baseline; improve relevance, coverage, and diversity based on evidence.
6. Make the Taste Map data-driven with traceable, deduplicated relationships.
7. Add monitored catalog ingestion, backups, operational monitoring, and an updated deployment/runbook guide.

See [architecture](architecture.md), [backend guide](backend.md), [ML roadmap](ml-roadmap.md), and [implementation roadmap](roadmap.md).
