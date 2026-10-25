# TASTERA Project Workflow

**Reviewed:** 2026-10-25. This workflow describes the live product and the next measurable improvements.

## Current state

```text
Vercel React frontend → Render FastAPI → Neon PostgreSQL
                           ├─ catalog search and pagination
                           ├─ accounts, saved Library, and feedback
                           └─ genre/co-save recommendation baseline
```

The frontend provides Discover, Profile, Library, Settings, Taste Map, Collections, Community preview, Guide, About, and Contact views. Production API calls stay on the frontend origin at `/api/v1` and are proxied by Vercel to Render. Account sessions cache a per-account Library snapshot in `sessionStorage`; temporary failures preserve it and expose manual refresh, while a confirmed `401` triggers sign-in. Cross-media pathways and creator pages reuse catalog metadata and API text search. Taste Map connections come from account activity and shared genre tags. The pathways explain their evidence; they do not predict personal preference. Books and Music imports are repeatable commands, but catalog completeness and image reliability remain ongoing work.

## Work order

1. **Improve evidence quality:** add source-attributed structured themes, settings, influences, and creator relationships where provider data supports them; normalize aliases and preserve provenance.
2. **Improve catalog usefulness:** expand Books/Music with mainstream and well-covered items; repair duplicates, genre metadata, and artwork; keep importer runs repeatable and observable.
3. **Evaluate recommendation quality:** collect enough user signals to compare relevance, coverage, and diversity, then preserve an untouched final holdout where feasible.
4. **Build category-specific recommenders:** evaluate book and music approaches when interaction data is adequate; treat cross-media ranking as a separate study.
5. **Reliability and security:** cover account isolation, saves, feedback, discovery pathways, and pagination with tests; add account recovery/security controls and operational backup/monitoring guidance.
6. **MovieLens research:** reproduce notebook runs before making fresh claims. MovieLens is movie-only and cannot validate cross-media performance.

See [Project Status](PROJECT_STATUS.md) for the feature inventory and [roadmap](roadmap.md) for planned milestones.

## Development loop

1. Check the current branch and working tree; preserve uncommitted user data.
2. Inspect the relevant UI, API contract, and source metadata.
3. Implement the user-visible behavior with clear empty, loading, and error states.
4. Keep guide/about text and repository docs aligned with behavior and limitations.
5. Run relevant existing build/lint/validation commands and report exactly what ran.
6. Update current status and technical guides with each completed milestone.
7. The user asks to be consulted before commits as a standing rule; a direct request to commit/push authorizes the requested commit and push.

## Deployment and data notes

- Frontend: Vercel. Backend: Render. Production database: Neon.
- Backend configuration uses `TASTERA_DATABASE_URL`, `TASTERA_AUTH_SECRET`, and `TASTERA_CORS_ORIGINS`.
- Do not expose secrets in frontend variables, commits, screenshots, or chat. The TMDb token is only needed for manual imports.
- Keep raw datasets, private account data, and credentials out of Git. Record source terms and actual experiment outputs; do not invent metrics.
- Describe For You as the current baseline until a defined evaluation supports stronger claims.

## References

- [Project status](PROJECT_STATUS.md)
- [Implementation roadmap](roadmap.md)
- [Architecture](architecture.md)
- [Frontend guide](frontend.md)
- [Backend guide](backend.md)
- [Recommendation research roadmap](ml-roadmap.md)
- [Dataset register](dataset-register.md)
