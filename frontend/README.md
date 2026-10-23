# TASTERA Frontend

React, TypeScript, and Vite client for the TASTERA cross-media discovery app.

## Product views

- **Discover:** API-backed movie, book, and music browsing with title/creator/genre search, category and genre filters, popularity ordering, pagination, and selectable 50/100/150 page sizes. Six editorial demo records support browsing when the API is unavailable.
- **Connection Explorer:** open an item to follow exact shared genre tags, matching creator credits, or shared words in eligible Tastera editorial notes. The explorer can open another item or its creator page. Saved/feedback activity is identified separately from catalog evidence.
- **Creator pages:** use the catalog search API and exact normalized creator credits to gather that creator's records across media types.
- **Taste Map:** graphs the user's saved and feedback items around shared catalog genres, with deduplicated links, pan/zoom controls, related catalog items, and a genre search view.
- **Accounts and Library:** registration/sign-in uses the backend; saved media is account-scoped and persisted through the API. A bearer token is held in `sessionStorage`.
- **For You and Settings:** personalized onboarding, mixed recommendations, batch refresh, configurable category proportions, movie ranking strategy, and persisted “More like this” / “Not for me” feedback.
- **Profile:** saved-item counts, category and genre patterns, recent saves, and feedback summaries.
- **Collections:** themed shelves and shareable snapshot links stored locally in the browser; edits do not sync to an already shared copy.
- **Guide, About, Contact:** in-app help, scope and limitations, and developer contact links.

The pathway explorer makes only claims supported by the fields available: creator credits, normalized genre tags, shared concepts in curated editorial notes, and explicitly labeled user activity. The catalog does not consistently record settings or influences, so those are not inferred. Connection pathways explain relationships; they do not predict user preference. For You uses a transparent recommendation baseline and has not established cross-media model quality.

## Local development

Use a current Node.js LTS release and npm:

```powershell
cd frontend
npm install
npm run dev
```

Vite prints its local address, usually `http://localhost:5173`. The API client defaults to `/api/v1`; for a local FastAPI server on port 8000, create `frontend/.env.local`:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

Run the backend separately; setup and catalog import commands are in [the backend guide](../docs/backend.md).

## Build and lint

```powershell
npm run build
npm run lint
```

These commands check the TypeScript/Vite production build and lint rules. They do not replace a deployed browser/API integration check.

## Key files

| Path | Responsibility |
|---|---|
| `src/App.tsx` | Main views and application state |
| `src/components/ConnectionExplorer.tsx` | Cross-media evidence paths and creator/theme catalog views |
| `src/components/TasteMap.tsx` | User activity graph and related catalog exploration |
| `src/components/MediaCard.tsx` | Shared catalog and recommendation cards |
| `src/services/` | Catalog, account, saved-media, and recommendation API clients |
| `src/data/media.ts` | Small offline fallback catalog |
| `src/types/` | Shared TypeScript models |

See [project status](../docs/PROJECT_STATUS.md) and the [roadmap](../docs/roadmap.md) for completed work and current gaps.
