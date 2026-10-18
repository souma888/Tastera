# TASTERA Project Workflow

**Reviewed:** 2026-10-18. The app is deployed and the foundation is working; this workflow starts from the current product, not the original prototype plan.

## Current state

```text
Vercel frontend → Render FastAPI → Neon PostgreSQL
                     ├─ Catalog API (Movies, Books, Music)
                     ├─ Accounts and saved Library
                     └─ Genre recommendations + stored feedback
```

Discover uses catalog API search, categories, and pagination. The backend also supports account registration/sign-in, saved media, recommendations, and persisted `more`/`less` feedback. The local fallback has six demo items. TMDb movie import is manual. Profile is incomplete, Taste Map is static prototype data, and Books/Music coverage is limited. Recommendation ranking is a simple genre baseline, not evaluated ML.

## Work order

Follow the user's stated product priorities first:

1. **Profile:** inspect available account data; define and build a useful data-backed profile view.
2. **Books and Music:** choose sources whose terms permit the intended use, increase catalog coverage, and document a safe repeatable import process.
3. **For You refresh:** allow a signed-in user to request another recommendation batch, with clear loading/error states and limited duplicate results.
4. **Quality and reliability:** test account isolation, saves, feedback and undo; evaluate ranking quality, coverage, and diversity.
5. **Taste Map:** derive displayed nodes and connections from traceable data, deduplicate accidental duplicate edges, and make the view accessible.
6. **Operations and security:** add monitoring, backup/restore and release guidance; plan email verification, recovery, session revocation, and rate limiting.
7. **Research:** rerun MovieLens notebooks and establish a leakage-aware top-K evaluation before making model-quality claims.

The current priorities and known limitations are maintained in [Project Status](PROJECT_STATUS.md); the [roadmap](roadmap.md) tracks implementation scope.

## Development loop

1. Check branch and working tree before changing files. Preserve existing user changes.
2. Select one complete user-visible or foundational outcome and define what success looks like.
3. Inspect the relevant API, data model, and current UI. Keep docs aligned with actual behavior.
4. Implement across the necessary frontend/backend/data layers, including useful loading, empty, and error states.
5. Run the relevant existing checks when appropriate and report exactly what ran. Do not claim an unrun check passed.
6. Update project status and technical docs in the same work item.
7. Ask before committing unless the user explicitly asks for a commit in that request. Push/deploy only when asked or clearly authorized.

## Deployment and data notes

- Frontend: Vercel. Backend: Render. Production database: Neon PostgreSQL.
- Backend configuration is managed in the host environment: `TASTERA_DATABASE_URL`, `TASTERA_AUTH_SECRET`, and `TASTERA_CORS_ORIGINS`.
- Do not expose secrets in frontend variables, commits, screenshots, or chat. TMDb token is only needed for manual catalog imports, not routine browsing.
- Do not put raw MovieLens files or private user data in Git. Record actual source, terms, and experiment outputs; do not invent metrics.
- Keep recommendations described as genre-weighted baseline until a defined evaluation supports stronger claims.

## References

- [Project status](PROJECT_STATUS.md)
- [Implementation roadmap](roadmap.md)
- [Architecture](architecture.md)
- [Frontend guide](frontend.md)
- [Backend guide](backend.md)
- [Recommendation research roadmap](ml-roadmap.md)
- [Dataset register](dataset-register.md)
