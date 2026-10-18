# TASTERA Frontend

React + TypeScript + Vite interface for TASTERA, a cross-media discovery prototype.

## Current features

- Discover page with a hero section, search, and category filters.
- Reusable media cards for movies, books, and music.
- In-memory saved items and a Library view.
- Taste Map demonstration view.
- Profile placeholder.

Discover requests `GET /api/v1/media` through the typed client in
`src/services/catalogApi.ts`. Set `VITE_API_BASE_URL` to a deployed backend URL
(for example, `https://api.example.com/api/v1`). When the API is unavailable,
the app clearly falls back to the small local demo catalog in `src/data/media.ts`.
Saves are held in React state and reset when the page reloads. The Taste Map is
a prototype and is not generated from a trained model or live user data.

## Requirements

- Node.js (use a current LTS release where possible)
- npm

## Local development

From the repository root:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

To use the local FastAPI catalog, run the backend on port 8000 and create
`frontend/.env.local` with:

```text
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

## Build and lint

```powershell
npm run build
npm run lint
```

Run these commands after changes. Build/lint results should be checked locally before claiming a change is validated.

## Project structure

```text
src/
├── components/
│   ├── MediaCard.tsx
│   ├── TasteMap.tsx
│   └── TasteMap.css
├── data/
│   └── media.ts
├── services/
│   └── catalogApi.ts
├── types/
│   └── media.ts
├── App.tsx
├── App.css
└── index.css
```

- `App.tsx`: current page selection, search/filter state, and saved-item state.
- `components/MediaCard.tsx`: reusable media card.
- `components/TasteMap.tsx`: Taste Map prototype.
- `services/catalogApi.ts`: typed catalog API client.
- `data/media.ts`: fallback catalog when the API is unavailable.
- `types/media.ts`: TypeScript media interfaces.

## Next integration step

The catalog API integration is complete for the current development fixture.
Durable saved items and profiles should next use authenticated backend APIs and a
database, rather than relying on page-local state.

See [frontend guide](../docs/frontend.md), [architecture](../docs/architecture.md), and [project status](../docs/PROJECT_STATUS.md).
