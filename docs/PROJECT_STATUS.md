# TASTERA Project Status

**Last reviewed:** 2026-10-23
**Status:** Live cross-media discovery product; catalog pathways and personal activity views are implemented.
**Scope:** Movies, books, and music discovery with visible catalog and user-activity connections.

## Implemented product

### Discover and catalog pathways

- Browse the API catalog by category and genre; search titles, creators, and genres; sort by provider popularity; use pagination with a 50, 100, or 150 item page size.
- Open a catalog or recommendation card to see explainable pathways across media. The explorer uses exact normalized genre tags, matching creator credits, and overlapping concepts in eligible Tastera editorial notes. It labels a user's saves/feedback separately.
- Open creator pages that group items with the same normalized catalog creator credit.
- Search catalog records for an exact normalized genre from a Taste Map theme node.
- Broken Music artwork can use title-specific Cover Art Archive alternatives; records with no artwork URL are omitted by the catalog API, and browser-detected broken-cover items are hidden in Discover.

### Personal discovery

- Accounts, account-scoped saved Library, and persistent recommendation feedback.
- Profile summaries show saved counts, media mix, recurring genres, recent saves, and feedback.
- For You uses saved items, onboarding preferences, category mix, feedback, popularity, and movie co-save similarity where available. Users can refresh the batch and adjust the mix and movie strategy.
- Onboarding accepts favorite catalog items, artists/creators, genres, and moods.
- Taste Map is built from the user's saved items and recommendation feedback. It links those signals to shared genres, deduplicates edges, supports pan/zoom and node selection, and shows related catalog items.
- Collections support themed shelves and shareable snapshots. Collections live in the browser; changes are not synchronized to an earlier shared snapshot.
- Guide, About, and Contact sections describe the current interface and project.

### Backend, data, and research

- FastAPI, SQLAlchemy, Alembic, Neon PostgreSQL in production, and SQLite for local setup.
- Account authentication with Argon2 password hashing and signed bearer sessions; per-account saved media and recommendation feedback.
- Manual importers for popular TMDb movies, rating-ranked Open Library works, and popularity-proxy MusicBrainz albums with confirmed Cover Art Archive covers.
- MovieLens audit/recommender notebooks and app-feedback offline evaluation tooling.

## Connection and recommendation limits

- Pathways are catalog discovery links, not recommendations of predicted preference. Creator and genre links use catalog metadata. Shared editorial-theme words are interpretive and are labeled as such. Setting and influence metadata is not consistently available, so the app does not manufacture those links.
- Creator matches are based on the exact normalized creator-credit field. They do not yet merge aliases, pseudonyms, group members, or co-author credit variants.
- Taste Map activity nodes use saved and feedback records; genre browsing returns exact catalog genre matches from the indexed catalog search. Item and creator lookups are currently capped by the API's 150-result page maximum.
- The For You ranking is a transparent baseline with a movie item-item co-save option; book/music recommenders and cross-media ranking are not trained/evaluated as separate models. App-feedback metrics remain insufficient until the evaluator's cohort threshold is met.
- Books and Music catalog breadth, genre completeness, and image URL reliability still need ongoing curation.

## Remaining work

1. Gather enough distinct user feedback to compare recommendation relevance, variety, and catalog coverage on real app signals; preserve an untouched final evaluation where the data supports it.
2. Continue improving catalog breadth, popular-item coverage, genres, creator normalization, duplicate handling, and artwork reliability across Books and Music.
3. Add consistent structured theme, setting, influence, and cross-media relationship metadata with source provenance if those pathways are to go beyond current creator/genre/editorial evidence.
4. Build and separately evaluate book and music recommenders when sufficient interaction data exists; only then assess personalized cross-media ranking.
5. Add backend and browser end-to-end coverage for accounts, isolation, saves, feedback, pagination, creator/theme lookups, and connection explanations.
6. Address account security gaps: email verification, password recovery, session revocation, and login rate limiting.
7. Add production monitoring, database backup/restore guidance, migration checks, import-run observability, and release/rollback procedures.
8. Re-run MovieLens notebooks when making fresh reproducibility claims; the current experiments do not establish cross-media quality.

See [roadmap](roadmap.md), [architecture](architecture.md), [frontend guide](frontend.md), [backend guide](backend.md), and [ML roadmap](ml-roadmap.md).
