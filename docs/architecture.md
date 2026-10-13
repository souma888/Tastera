# TASTERA Architecture

**Status:** The target architecture below is a design direction. Only the frontend prototype, FastAPI health endpoint, and offline recommendation experiments currently exist.

## Current implementation

```text
Browser
  └── React + TypeScript + Vite
        ├── local sample catalog (six media items)
        ├── browser-side search and category filters
        ├── in-memory saved-item state
        └── predefined Taste Map prototype

FastAPI application
  └── GET /health

Offline research
  ├── MovieLens audit notebook
  ├── baseline recommender notebook
  └── Python baseline classes
```

The frontend and backend are not yet integrated. There is no application database or authenticated user state.

## Target architecture (incremental)

```text
React frontend
  └── versioned HTTP API (/api/v1)
        └── FastAPI
              ├── catalog/search service
              ├── interaction and profile service
              ├── recommendation service
              └── relationship/Taste Map service
                    └── PostgreSQL
                         ├── catalog and identifiers
                         ├── users and interactions
                         └── media relationships

Catalog ingestion jobs ──> validated catalog records
Offline ML experiments ──> versioned model/artifact ──> recommendation service
```

This is a proposed destination, not a claim that these components are already implemented.

## Main design principles

1. **One normalized catalog:** represent movies, books, music, and future categories through a shared core schema, with optional category-specific metadata.
2. **Stable internal IDs:** do not use provider IDs or titles as the application's only identifier. Store external IDs separately with their source.
3. **API boundary:** the frontend should request catalog data and submit interactions through the backend rather than importing the catalog directly.
4. **User-scoped data:** once accounts exist, a user must only be able to read or modify their own private interactions and collections.
5. **Data provenance:** retain the source and retrieval/update details for imported metadata and relationships.
6. **Reproducible ML:** separate offline training/evaluation code from request-time inference; record dataset, split, configuration, metrics, and artifact version.
7. **Incremental complexity:** begin with a simple database and baseline model. Add vector search, graph infrastructure, queues, or separate services only when measured needs justify them.

## Proposed core entities

| Entity | Purpose |
|---|---|
| `media_items` | Canonical item ID, title, category, description, release/publication date, artwork URL and timestamps |
| `media_identifiers` | Provider, external ID, and linked canonical media item |
| `genres` / `media_genres` | Normalized genre labels and many-to-many membership |
| `users` | Account identity and authentication metadata |
| `user_interactions` | User, media item, interaction type, optional rating, and event time |
| `collections` / `collection_items` | User-created lists, if needed |
| `media_relationships` | Source item, target item, relationship type, evidence/provenance, and optional confidence |
| `ingestion_runs` | Source, run time, status, counts, and errors for catalog jobs |

Treat this as a starting point; finalize fields and constraints when implementing database migrations. Do not store passwords in plain text.

## Request flow

1. The frontend requests a paginated catalog endpoint.
2. FastAPI validates query parameters and calls the catalog service.
3. The service reads normalized records from the database.
4. The API returns a stable response schema; the frontend renders loading, empty, success, and error states.
5. Once authentication and interactions are implemented, likes/saves/ratings are sent to the backend and associated with the authenticated user.
6. Recommendation requests retrieve candidates, score/rank them, and return explanations or available relationship evidence.

## Deployment direction

A practical first deployment can use Vercel for the frontend, a Python-compatible host for FastAPI, and managed PostgreSQL. Configure the frontend API base URL via environment variables, restrict CORS to known frontend origins, and keep secrets in host environment settings. The current Vercel frontend deployment does not deploy the backend automatically.
