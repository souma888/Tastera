# TASTERA Frontend

React + TypeScript + Vite interface for TASTERA, a cross-media discovery prototype.

## Current features

- Discover page with a hero section, search, and category filters.
- Reusable media cards for movies, books, and music.
- In-memory saved items and a Library view.
- Taste Map demonstration view.
- Profile placeholder.

The current catalog consists of six sample items in `src/data/media.ts`. The frontend is not yet connected to the FastAPI backend. Saves are held in React state and reset when the page reloads. The Taste Map is a prototype and is not generated from a trained model or live user data.

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
├── types/
│   └── media.ts
├── App.tsx
├── App.css
└── index.css
```

- `App.tsx`: current page selection, search/filter state, and saved-item state.
- `components/MediaCard.tsx`: reusable media card.
- `components/TasteMap.tsx`: Taste Map prototype.
- `data/media.ts`: temporary local sample catalog.
- `types/media.ts`: TypeScript media interfaces.

## Next integration step

When the backend catalog endpoint is available, introduce a typed API client and replace the static catalog import with API data. Include loading, empty, and error states. Durable saved items and profiles should later use authenticated backend APIs and a database, rather than relying on page-local state.

See [frontend guide](../docs/frontend.md), [architecture](../docs/architecture.md), and [project status](../docs/PROJECT_STATUS.md).
