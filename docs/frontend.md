# Frontend Guide

## Stack

- React
- TypeScript
- Vite
- CSS in `src/index.css` and component/application stylesheets

## Current interface

The prototype contains:

- Discover page with a hero section, search, category filters, and media cards.
- Library view showing items saved during the current page session.
- Taste Map prototype.
- Profile placeholder with summary counts.
- Shared `MediaCard` component and a shared `Media` TypeScript type.

The current catalog is the static array in `src/data/media.ts`. Artwork is loaded from external image URLs. The app currently supports Movies, Books, and Music, but the broader product may add other categories later.

## Local development

From the repository root, open a terminal:

```powershell
cd frontend
npm install
npm run dev
```

Vite prints the local URL to open in a browser, usually `http://localhost:5173`.

## Validation

```powershell
npm run build
npm run lint
```

Use the scripts actually present in `frontend/package.json`; if a script name changes, update this guide. A production build checks TypeScript/Vite compilation but is not a substitute for browser and integration testing.

## Current behavior and limitations

- Search and filters run locally against the six sample records.
- Saved items are held in React state. Refreshing the page resets them.
- There is no sign-in, backend API integration, or cross-device persistence.
- Taste Map nodes and edges are demonstration data, not derived from a user's interactions.
- External artwork availability and usage terms depend on the source.

These are known prototype boundaries, not unexpected bugs.

## Planned API integration

When the catalog API is ready, replace direct imports from `src/data/media.ts` with a typed API client. Keep the `Media` UI model stable where possible and map API responses at the boundary. Add explicit loading, empty, and error states, and keep pagination/search parameters out of presentation-only components.

Do not introduce frontend-only fake persistence as a substitute for the eventual user database. A small local demo cache can be temporary if clearly labelled, but the intended durable behavior belongs in the backend/database.

## Main files

| Path | Responsibility |
|---|---|
| `src/App.tsx` | Page selection, current search/filter/saved state |
| `src/components/MediaCard.tsx` | Reusable media card |
| `src/components/TasteMap.tsx` | Current Taste Map prototype |
| `src/data/media.ts` | Temporary sample catalog |
| `src/types/media.ts` | Frontend media and component types |
| `src/index.css`, `src/App.css`, component CSS | Visual design and layout |
