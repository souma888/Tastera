# Frontend Guide

## Stack and deployment

The client uses React, TypeScript, and Vite. Production frontend: [soumadip-tastera.vercel.app](https://soumadip-tastera.vercel.app). The API is hosted separately at [tastera.onrender.com](https://tastera.onrender.com); Vercel does not host the FastAPI service.

## Current behavior

- **Discover:** paginated catalog API, category filters, and search. A six-item local catalog is used when the API cannot be reached.
- **Account:** registration/sign-in through the backend. The signed bearer token is held in `sessionStorage` and expires after 12 hours.
- **Library:** account-scoped saved media persisted by the backend.
- **For You:** recommendations from the backend genre-weighting baseline; signed-in users can submit persisted “More like this” or “Not for me” feedback.
- **Taste Map:** predefined prototype graph, not derived from catalog relationships or the user's data. A duplicate-looking edge issue is known.
- **Profile:** placeholder; data-backed profile work remains open.

Movies, Books, and Music are supported categories, but Books and Music have limited coverage. Recommendations are not a trained ML system and do not yet provide cross-media ranking.

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

A successful build/lint does not verify production API connectivity, account isolation, or the complete browser flow.

## Main source areas

| Path | Responsibility |
|---|---|
| `frontend/src/App.tsx` | Main view selection and UI state |
| `frontend/src/services/` | HTTP clients for catalog and user features |
| `frontend/src/components/` | Shared media cards and visual components |
| `frontend/src/data/media.ts` | Offline fallback content |
| `frontend/src/types/` | Frontend data types |

See [project status](PROJECT_STATUS.md) for the current feature backlog.
