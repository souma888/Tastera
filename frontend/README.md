# TASTERA Frontend

React, TypeScript, and Vite client for the TASTERA discovery app.

## Implemented views and behavior

- Discover reads the catalog through the typed API client, with search, category filters, and pagination. A six-item local catalog is available as an offline fallback.
- Sign-up and sign-in connect to the backend account API.
- Library loads saved media for the signed-in account and persists changes through the API.
- For You loads backend genre-based recommendations for signed-in users. “More like this” and “Not for me” send persistent recommendation feedback.
- Taste Map is fixed prototype data; Profile is not yet a complete, data-backed profile.

The recommendation baseline is genre-weighted content matching, not a trained ML model. Books and Music catalog coverage is currently limited.

## Requirements and local development

Use a current Node.js LTS release and npm.

```powershell
cd frontend
npm install
npm run dev
```

Vite prints the local address, usually `http://localhost:5173`. The API client defaults to `/api/v1`; for local FastAPI on port 8000, create `frontend/.env.local`:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

Run the backend separately; its setup is documented in [docs/backend.md](../docs/backend.md).

## Build and lint

```powershell
npm run build
npm run lint
```

These commands check the frontend build and lint rules; they do not replace browser/API integration checks.

## Key files

| Path | Responsibility |
|---|---|
| `src/App.tsx` | Main views and application state |
| `src/services/` | Catalog, account, saved media, and recommendation API clients |
| `src/components/` | Shared media and visualization components |
| `src/data/media.ts` | Small offline fallback catalog |
| `src/types/` | Shared TypeScript models |

For current gaps and product priorities, see [project status](../docs/PROJECT_STATUS.md) and [roadmap](../docs/roadmap.md).
