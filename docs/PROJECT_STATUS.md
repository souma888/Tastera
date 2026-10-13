# TASTERA Project Status

**Last reviewed:** 2026-10-13  
**Status:** Early prototype and research foundation  
**Scope:** Cross-media discovery across movies, books, music, and potential future categories.

This document separates what is present in the repository from proposed work. A feature described in the vision is not considered implemented until there is working code and appropriate tests.

## Implemented in the repository

### Frontend prototype

- React, TypeScript, and Vite application under `frontend/`.
- Dark-themed Discover interface with a hero section, search field, category filters, and reusable media cards.
- Six demonstration entries in `frontend/src/data/media.ts`: Interstellar, Dune, Random Access Memories, Arrival, The Midnight Library, and After Hours.
- Poster URLs are referenced from external image sources; the repository does not contain a full poster catalog.
- In-memory saved-item interactions and a Library view.
- Taste Map prototype using a predefined set of nodes and edges.
- Profile placeholder that summarizes the current in-memory saved items.
- A Vercel preview has been configured by the maintainer. Deployment configuration and current domain should be checked in Vercel.

### Backend foundation

- FastAPI application entry point in `backend/app/main.py`.
- `GET /health` health-check endpoint.
- Basic health-check test in `backend/tests/test_health.py`.
- Requirements for FastAPI, Uvicorn, Pydantic, pytest, and HTTPX.

### Recommendation research

- MovieLens Latest Small dataset audit notebook: `notebooks/01_dataset_audit.ipynb`.
- Baseline recommender notebook: `notebooks/02_baseline_recommenders.ipynb`.
- Reusable baseline classes in `src/tastera/recommenders/baselines.py`:
  - global-mean rating prediction;
  - user-mean rating prediction;
  - popularity ranking;
  - genre-overlap content-based ranking.
- Dataset register, data dictionary, and experiment notes in `docs/`.

The recorded MovieLens audit covers 9,742 movies, 100,836 ratings, 3,683 tags, and 610 users. Its recorded follow-up output reports zero duplicate `(userId, movieId)` pairs, zero missing rating values, and no values outside the expected half-star scale. The baseline notebook's path has since been made portable, and its stale code-cell outputs have been cleared. Rerun both notebooks locally before treating the experiments as freshly reproduced.

## Known limitations

- Discover still uses a local six-item sample array; it does not fetch a catalog from FastAPI.
- Search and category filtering run in the browser against those six items.
- Saved items exist only in React state and are lost on refresh. There is no account system or persistent user-interaction database yet.
- The Profile view is a placeholder, not an authenticated user profile.
- The Taste Map uses fixed demonstration nodes and edges; it is not generated from a user's saved items or a recommendation graph. A visual issue with duplicate-looking straight edges remains to be diagnosed.
- The FastAPI backend has no media catalog endpoint, database integration, authentication, user-interaction API, or recommendation endpoint.
- The recommendation classes are research baselines, not a production recommendation service. No production model-serving pipeline is implemented.
- Automated multi-source catalog ingestion and synchronization are not implemented.
- Cross-media recommendations between movies, books, and music are a goal, not a demonstrated capability.
- The Vercel frontend deployment does not itself run the FastAPI backend or provide persistent storage.

## Recommended next milestones

1. Keep the current frontend checkpoint reproducible and document its local setup.
2. Define the canonical media schema and API contract.
3. Build and test the FastAPI application structure and a small media catalog endpoint.
4. Rerun the MovieLens audit and baseline experiment locally to verify the recorded outputs and updated notebook path.
5. Connect Discover to the catalog API, including loading, empty, and error states.
6. Add a database and migrations, then user authentication and per-user interactions when ready.
7. Evaluate ranking approaches before integrating model inference.
8. Replace hardcoded Taste Map data with validated catalog/user relationship data.
9. Add additional catalog sources and cross-media modeling after data rights, coverage, and quality are reviewed.

See [architecture](architecture.md), [frontend guide](frontend.md), [backend guide](backend.md), [ML roadmap](ml-roadmap.md), and [development roadmap](roadmap.md).
