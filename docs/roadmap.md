# TASTERA Implementation Roadmap

**Reviewed:** 2026-10-18. Shipped capabilities are listed as complete; open work is not presented as already implemented.

## Current baseline

The deployed application has a Vercel React frontend, Render FastAPI backend, and Neon PostgreSQL database. It supports catalog browsing, accounts, a saved Library, and genre-based recommendations with persistent feedback. See [project status](PROJECT_STATUS.md) for the detailed feature inventory and limitations.

## Next product priorities

These are the user's requested next changes, in order:

1. **Complete Profile:** replace the placeholder with useful account-backed taste and activity information, using existing saved items and feedback where possible.
2. **Expand Books and Music:** increase useful catalog coverage from reviewed, permitted sources; document source and attribution requirements and make imports repeatable.
3. **Refresh For You:** add a control near recommendations to request a different batch, especially movies. Define whether refresh rotates candidates or changes ranking and avoid repeating the same batch unnecessarily.

## Remaining work after those priorities

### Product and recommendation quality

- Verify feedback and undo against the deployed account flow; add backend/API tests for recommendations, feedback persistence, and account isolation.
- Evaluate recommendation relevance, catalog coverage, and diversity with a defined protocol. Current genre weighting is a baseline, not a validated model.
- Make the Taste Map use traceable catalog/user relationships and fix the duplicate-looking connection issue.

### Data and operations

- Establish repeatable Books and Music import paths and catalog deduplication/provenance.
- Add monitoring for API health, database/migration operations, and ingestion outcomes; document backup/restore and release/rollback procedures.
- Review account security gaps: email verification, recovery, session revocation, and rate limiting.

### Research

- Rerun the MovieLens audit and baseline notebooks in the current environment before treating recorded results as freshly reproduced.
- Define a leakage-aware top-K evaluation and compare methods on the same split/candidate set. MovieLens supports movie-only research, not cross-media quality claims.

## Completed foundation

- React/Vite frontend and FastAPI backend are deployed separately.
- Database-backed catalog with migrations and an idempotent editorial seed.
- Catalog API with detail lookup, search, categories, and pagination.
- Manual TMDb popular-movie import with provider-ID deduplication/upsert behavior.
- Account registration/sign-in, Argon2 password hashing, signed bearer sessions, and account-scoped saved items.
- For You genre baseline with persisted per-account “more”/“less” feedback.
- MovieLens research notebooks and documented baseline implementations (fresh reproducibility remains to be confirmed).

## How to use this roadmap

Keep one user-visible outcome at a time. Update [project status](PROJECT_STATUS.md) when behavior changes, the relevant setup/API guide when commands or contracts change, and research notes only with results actually observed. Do not commit credentials or raw datasets. Ask the user before committing changes, per their standing instruction; an explicit request to commit authorizes that commit.
