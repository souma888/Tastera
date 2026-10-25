# Frontend Guide

## Stack and deployment

The client uses React, TypeScript, and Vite. Production frontend: [soumadip-tastera.vercel.app](https://soumadip-tastera.vercel.app). The API is hosted separately at [tastera.onrender.com](https://tastera.onrender.com); Vercel does not host the FastAPI service.

## Current behavior

- **Discover:** catalog search across titles, creators, and genres; category and genre filters; popularity ordering; 50/100/150 item pages; paginated results, source/metadata freshness labels, and six local demo records when the API is unavailable.
- **Connection Explorer:** cards and recommendations open a detail view with cross-media pathways, exact creator pages, and genre exploration. Relationships state whether the basis is a matching creator credit, catalog genre, shared word in eligible editorial notes, or the user's own activity.
- **Taste Map:** uses the signed-in user's saved items and recommendation feedback, builds deduplicated genre links, and provides selection, pan/zoom, related catalog records, and an exact-tag genre lookup.
- **Account and Library:** sign-up/sign-in through the API; saved media, status, 1–5 personal rating, private note, and optional book/album progress persist per account. Library changes appear in an account-scoped recent activity timeline. Ratings contribute to that account's genre and movie co-save ranking; note text is not analyzed. The bearer token is in `sessionStorage`.
- **For You and Settings:** guest taste onboarding; personalized mixed batches; refresh; editable category proportions, popularity/novelty/familiarity weights, movie strategy, and saved/feedback explanations. Settings includes account export and deletion controls.
- **Community preview:** fictional sample explorers, sample activity, shared-genre suggestions, and curated community-list previews. Follow/copy actions are browser-local; no real users' activity is exposed or synced.
- **Profile:** category and genre summaries, recent saves, and feedback counts.
- **Collections:** themed shelves and shareable snapshot links. Collection state is local to the browser; shared edits do not sync back to the original.
- **Guide, About, Contact:** in-app product walkthrough, feature/limitation summary, and developer contact links.

The connection explorer is a metadata-based discovery feature, not a personalized cross-media prediction model. It only shows setting/influence links when those fields become supported by reliable source data; current editorial-theme overlaps are explicitly marked interpretive.

## Local development

```powershell
cd frontend
npm install
npm run dev
```

To connect to a local API at `http://127.0.0.1:8000`, create `frontend/.env.local`:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

Start the backend separately using [the backend guide](backend.md). The backend CORS setting must allow the local Vite origin. Do not put backend secrets in frontend environment variables; Vite variables are public in the built client.

## Validation

```powershell
npm run build
npm run lint
```

These checks validate frontend compilation and lint rules. They do not verify production API connectivity or the complete browser flow.

## Main source areas

| Path | Responsibility |
|---|---|
| `frontend/src/App.tsx` | Main view selection and UI state |
| `frontend/src/components/ConnectionExplorer.tsx` | Cross-media, creator, and genre catalog explorer |
| `frontend/src/components/TasteMap.tsx` | User activity map and related item browsing |
| `frontend/src/components/MediaCard.tsx` | Catalog and recommendation cards |
| `frontend/src/services/` | HTTP clients for catalog and user features |
| `frontend/src/data/media.ts` | Offline fallback content |
| `frontend/src/types/` | Frontend data types |

See [project status](PROJECT_STATUS.md) for current limitations and [roadmap](roadmap.md) for remaining work.
