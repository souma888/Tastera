# TASTERA Implementation Roadmap

**Reviewed:** 2026-10-23. Completed capabilities are distinguished from remaining product and operational work.

## Current product baseline

Tastera runs a React/Vite frontend on Vercel, a FastAPI API on Render, and Neon PostgreSQL in production. The app supports movie/book/music discovery, accounts, saved items, user feedback, Profile, For You, Taste Map, collections, and in-app project information. Catalog cards and Taste Map genres link into evidence-labeled cross-media and creator exploration. See [Project Status](PROJECT_STATUS.md) for current behavior and limits.

## Completed product priorities

- Built a data-backed Profile using saves, category/genre summaries, recent activity, and recommendation feedback.
- Added repeatable TMDb, Open Library, and MusicBrainz import commands, with popularity/rating selection and artwork handling appropriate to each source. Coverage and import monitoring still need work.
- Added For You batch refresh, duplicate avoidance, a configurable category mix, and recommendation feedback.
- Added title/creator/genre search, popular-first browsing, page-size selection, onboarding tastes, recommendation explanations, and catalog-based relationship/creator exploration.
- Made the Taste Map reflect saved/feedback activity and shared catalog genres; added traceability, related catalog results, selection, panning, and zoom.
- Expanded Guide/About/Contact sections to describe the product and its available features.

## Next product work

1. **Improve relationship evidence:** add source-attributed normalized themes, settings, influences, adaptations, and creator relationships as catalog sources support them. Keep inferred or editorial relationships clearly distinguished from facts.
2. **Normalize creator identities:** merge known aliases and credit variants while preserving the source credit and provenance.
3. **Improve Books and Music coverage:** curate mainstream catalog additions, genre completeness, duplicates, and resilient cover/artwork URLs; record each import's added/updated/skipped totals.
4. **Evaluate recommendations:** collect enough opt-in app interactions, compare relevance, catalog coverage, and diversity, and retain an untouched final evaluation where feasible.
5. **Build category-specific recommenders:** evaluate books and music methods only after there is enough suitable catalog and interaction data. Treat cross-media ranking as a separate research question.

## Reliability, security, and research

- Add API and browser-flow tests for accounts, user isolation, saves, feedback, pagination, creator/theme search, and pathways.
- Address email verification, password recovery, session revocation, and authentication rate limiting.
- Add service/database monitoring, backups and restore guidance, migration checks, import-run observability, and release/rollback procedures.
- Re-run MovieLens notebooks before asserting fresh reproducibility. MovieLens can support movie-only offline research; it cannot establish book/music or cross-media quality.

## Architecture notes

Current cross-media pathways are explainable catalog exploration, not personalized predictions. Shared genre and creator credit are direct catalog evidence; overlapping concepts in editorial notes are interpretive. Setting and influence data is not sufficiently structured yet. The current exact creator and genre search is limited to the API's 150-item query page.

## Development practice

Keep one user-visible outcome complete at a time. Update [project status](PROJECT_STATUS.md), the affected technical guide, and this roadmap when behavior changes. Do not commit credentials, raw datasets, or private user data. The user asked for approval before commits as a standing preference; an explicit request to commit/push authorizes that work.
