# TASTERA Implementation Roadmap

**Reviewed:** 2026-10-25. Completed capabilities are distinguished from remaining product and operational work.

## Current product baseline

Tastera runs a React/Vite frontend on Vercel, a FastAPI API on Render, and Neon PostgreSQL in production. The catalog supports movies, TV, books, music, games, and podcasts; personal ranking currently focuses on movies, books, and music. Account-backed collections/follows, private export imports, source-attributed relationships, regional watch links, and an installable app shell are implemented. See [Project Status](PROJECT_STATUS.md) for current behavior and limits.

## Completed product priorities

- Built a data-backed Profile using saves, category/genre summaries, recent activity, and recommendation feedback.
- Added repeatable TMDb, Open Library, and MusicBrainz import commands, with popularity/rating selection and artwork handling appropriate to each source. Coverage and import monitoring still need work.
- Added For You batch refresh, duplicate avoidance, a configurable category mix, and recommendation feedback.
- Added title/creator/genre search, popular-first browsing, page-size selection, onboarding tastes, recommendation explanations, and catalog-based relationship/creator exploration.
- Made the Taste Map reflect saved/feedback activity and shared catalog genres; added traceability, related catalog results, selection, panning, and zoom.
- Expanded Guide/About/Contact sections to describe the product and its available features.
- Added TV, Games, and Podcasts catalog categories with manual, on-demand free-tier import paths; added TMDb regional watch options and “Surprise me.”
- Replaced browser-only social foundations with account collections, revocable public share pages, opt-in public profiles, and a real follow graph.
- Added private Letterboxd/Goodreads/Spotify export matching, manually reviewed adaptation/creator-alias import paths, PWA shell caching, and keyboard-operable Taste Map controls.

## Next product work

1. **Measure new categories:** run modest import batches, inspect data coverage, and gather enough eligible feedback for category-specific ML Lab reports.
2. **Curate verified links and aliases:** source and review real adaptation/creator-alias rows before claiming those graph links are broadly available.
3. **Complete category-specific user experience:** broaden taste onboarding and ranking beyond Movies/Books/Music only after the new catalogs have enough quality and activity.
4. **Improve source attribution and catalog quality:** maintain provider terms, duplication checks, artwork reliability, and import-run monitoring as catalog coverage grows.
5. **Harden the social launch:** add reporting, blocking, abuse limits, and privacy review before growing public profile and collection discovery.

## Reliability, security, and research

- Preserve the current Library recovery behavior: temporary account/API outages must not clear a valid session or the cached per-account Library; confirmed `401` responses should request sign-in. Production requests must continue using the Vercel same-origin `/api/v1` rewrite.
- Expand API and browser-flow tests for accounts, user isolation, saves, feedback, pagination, creator/theme search, and pathways. A regression test covers saved-response `updated_at` precedence; broader browser coverage is still open.
- Address email verification, password recovery, session revocation, and authentication rate limiting.
- Add service/database monitoring, backups and restore guidance, migration checks, import-run observability, and release/rollback procedures.
- Re-run MovieLens notebooks before asserting fresh reproducibility. MovieLens can support movie-only offline research; it cannot establish book/music or cross-media quality.

## Architecture notes

Current cross-media pathways are explainable catalog exploration, not personalized predictions. Shared genre and creator credit are direct catalog evidence; overlapping concepts in editorial notes are interpretive. Setting and influence data is not sufficiently structured yet. The current exact creator and genre search is limited to the API's 150-item query page.

## Development practice

Keep one user-visible outcome complete at a time. Update [project status](PROJECT_STATUS.md), the affected technical guide, and this roadmap when behavior changes. Do not commit credentials, raw datasets, or private user data. The user asked for approval before commits as a standing preference; an explicit request to commit/push authorizes that work.
