# TASTERA Frontend

React, TypeScript, and Vite client for the TASTERA cross-media discovery app.

## Product views

- **Discover:** API-backed movie, book, and music browsing with title/creator/genre search, category and genre filters, popularity ordering, pagination, and selectable 50/100/150 page sizes. Six editorial demo records support browsing when the API is unavailable.
- **Semantic search:** use the **AI** toggle to search descriptions, themes, mood, and ideas across media with 384-dimensional Sentence Transformer vectors in PostgreSQL/pgvector. The API runs the query encoder through FastEmbed's quantized ONNX backend to fit small instances. Similarity results are model inferences, not factual relationships.
- **Connection Explorer:** open an item to follow exact shared genre tags, matching creator credits, or shared words in eligible Tastera editorial notes. The explorer can open another item or its creator page. Saved/feedback activity is identified separately from catalog evidence.
- **Creator pages:** use the catalog search API and exact normalized creator credits to gather that creator's records across media types.
- **Taste Map:** graphs the user's saved and feedback items around shared catalog genres, with deduplicated links, pan/zoom controls, related catalog items, and a genre search view.
- **Accounts and Library:** registration/sign-in uses the backend; saved media is account-scoped and persisted through the API. A bearer token and a per-account Library snapshot are held in `sessionStorage` for the current tab session. A temporary API/network failure keeps cached items visible and offers a manual Library refresh; only a confirmed `401` clears the session and requests sign-in. The server remains authoritative, and the client does not automatically retry account mutations.
- **For You and Settings:** personalized onboarding, mixed recommendations, batch refresh, configurable category proportions, movie ranking strategy, and persisted “More like this” / “Not for me” feedback.
- **ML Lab:** compare genre, movie item-item, and embedding ranking with Precision@K, Recall@K, NDCG@K, catalog coverage, and diversity when the evaluation cohort is large enough.
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

Vite prints its local address, usually `http://localhost:5173`. The API client defaults to `/api/v1`. In production, Vercel rewrites that same-origin path to the Render API; the production client intentionally ignores an absolute `VITE_API_BASE_URL` override to avoid bypassing the proxy. For a local FastAPI server on port 8000, create `frontend/.env.local`:

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
