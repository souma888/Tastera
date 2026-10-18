# TASTERA End-to-End Project Workflow

**Purpose:** One practical reference for what to do, in what order, why the order matters, and what must be true before moving on.  
**Project state reviewed:** 2026-10-18.  
**Current stage:** Early prototype and research foundation. The frontend is a static demo, FastAPI only has a health endpoint, and the MovieLens recommender code is offline research. Planned capabilities below are not claims about existing behavior.

## The sequence at a glance

```text
0. Re-establish a reproducible baseline
        ↓
1. Decide the first shippable product slice and its data contract
        ↓
2. Build a small canonical catalog and read-only catalog API
        ↓
3. Verify the MovieLens audit and make ranking evaluation valid (can run alongside 2)
        ↓
4. Connect Discover to the API and complete the end-to-end catalog flow
        ↓
5. Add persistent storage and migrations
        ↓
6. Add accounts and private user interactions
        ↓
7. Evaluate and serve a recommendation baseline
        ↓
8. Build Taste Map from evidenced relationships and user context
        ↓
9. Expand sources, harden operations, and deploy the complete system
```

The first useful vertical slice is **a small catalog served by FastAPI and rendered by Discover**. It proves the product's main data path without requiring accounts or a production ML model. The MovieLens research track can run in parallel with catalog/API work after its inputs and evaluation protocol are explicit.

## Where the project stands now

| Area | Present | Missing before product use |
|---|---|---|
| Frontend | React/TypeScript/Vite; Discover, Library, Taste Map and Profile views; six local demo items | API client, API-backed catalog, real account/profile, durable saves, data-driven map |
| Backend | FastAPI app and `GET /health` | Product routes, catalog service, persistence, auth, recommendation route |
| Data | MovieLens Latest Small is documented as a local research input; raw data belongs outside Git | A product-ready, licensed, normalized catalog and repeatable ingestion process |
| ML | Transparent global/user mean, popularity and genre-overlap baselines; two notebooks | Fresh reproduction, valid top-K metrics, model selection evidence, tested serving integration |
| Deployment | Frontend preview has been configured by maintainer | A deployed backend, database, integrated environment configuration, operational checks |

The six-item frontend sample and the MovieLens benchmark have different jobs: the sample is UI demonstration data; MovieLens is movie-only research data. Do not treat either as the live, cross-media product catalog.

## Workflow details

### Stage 0 — Re-establish a known-good checkpoint

**Why first:** A reliable starting point makes later failures attributable to new work rather than an unknown baseline.

1. Pull/inspect the intended branch and check the working tree before editing.
2. Follow the frontend and backend setup guides; install from the committed lock/requirements files.
3. Confirm the frontend build and lint scripts, and run the backend health test.
4. Start the services locally and confirm the frontend renders and `/health` responds.
5. Record environment or setup issues in the guide; do not claim checks passed until run locally.

**Complete when:** a fresh checkout can install, start, and validate the current frontend and backend with documented commands.

**Current next action:** establish this baseline. This project workflow does not presume the build, lint, tests, or notebook runs have just been executed.

### Stage 1 — Lock the first product slice and contract

**Recommended slice:** browse a small, curated catalog in Discover from the backend, with search, category filtering, stable pagination, and clear loading/empty/error behavior.

Before implementation, write down:

- In-scope categories for the first slice (keep the first catalog small and curated).
- Canonical media fields and allowed values; distinguish required fields from category-specific optional metadata.
- Stable internal IDs, external identifiers with source names, and metadata provenance.
- Search/filter semantics, sort order, pagination shape, and error responses.
- What the demo seed contains and how it is labelled.

Use `docs/architecture.md` and the data dictionary as starting points. Keep a simple schema and API contract under version control and update them with implementation. Avoid deciding on graph/vector infrastructure or a complex model here.

**Complete when:** frontend and backend can implement against the same reviewed contract without guessing field names or behavior.

### Stage 2 — Build the catalog and read API

1. Create the canonical media schema and validation rules.
2. Add a small, clearly labelled development seed. Keep provider IDs separate from internal IDs.
3. Implement a versioned catalog endpoint, initially backed by the seed or a simple local store. Support deterministic ordering, search/filter, and pagination.
4. Keep route parsing/validation in the API layer and business logic in services.
5. Test normal results, no results, invalid filters/pages, unknown detail IDs (if detail is in scope), and stable pagination.
6. Document the actual OpenAPI/API contract and local run instructions.

Database selection is a deliberate sub-decision: a seed-backed first slice can demonstrate the contract; choose a database and migration tool before durable user/catalog data is introduced. Do not add persistence prematurely if it delays the first end-to-end slice.

**Complete when:** the API returns validated, paginated catalog records and automated checks cover success and failure cases.

### Stage 3 — Make the research baseline reproducible (parallel track)

This track can proceed while the catalog API is being built because it uses MovieLens and does not depend on the app catalog.

1. Obtain the documented MovieLens archive locally at `data/raw/movielens/ml-latest-small/`; preserve raw files and keep them out of Git.
2. Review the dataset's included terms and update the dataset register with the actual download/version date when known.
3. Run `notebooks/01_dataset_audit.ipynb` top-to-bottom. Recheck schemas, missingness, duplicate rating keys, rating scale, joins, identifier coverage, timestamps, and split assumptions.
4. Run `notebooks/02_baseline_recommenders.ipynb` top-to-bottom. Record actual outputs, package versions, input provenance, and split definition. Do not reconstruct metrics from memory.
5. Add a top-K ranking evaluation before choosing a ranking model: define held-out relevant items, eligible users, candidate catalog, unseen-item policy, and K. Prevent test-data leakage into features/popularity/candidates.
6. Compare simple baselines on the same split and candidate set. Inspect sample recommendations and note coverage/cold-start limitations.
7. Update experiment notes and the ML roadmap with the observed result and the next hypothesis.

Rating prediction MAE/RMSE and top-K ranking metrics measure different tasks; report them separately. MovieLens evidence supports movie research only, not a cross-media quality claim.

**Complete when:** another developer can follow the documented inputs and steps and reproduce the recorded analysis, and model comparisons use a defined, leakage-aware protocol.

### Stage 4 — Connect Discover and prove the vertical slice

1. Add a typed frontend API client and configurable API base URL.
2. Replace the static catalog import in the Discover data path with API calls; keep demo fixtures only where useful for isolated UI work.
3. Implement loading, empty, and recoverable error states.
4. Keep query, filter, sorting, and pagination behavior aligned with the API contract.
5. Configure local CORS/API origin and verify the full browser → API → catalog → rendered card flow.
6. Update the frontend guide and root setup instructions.

**Complete when:** a developer can start both services locally and use Discover to search/filter/paginate backend catalog data, with expected states visible when requests succeed or fail.

This is the first strong product checkpoint. Capture a demo and review usability before adding account complexity.

### Stage 5 — Add durable catalog and interaction storage

1. Select the database and migration approach based on deployment needs and team familiarity.
2. Define constraints and indexes for canonical items, provider identifiers, genres, and provenance.
3. Add migrations and a repeatable development seed/import path.
4. Move catalog reads/writes behind repository/service boundaries; do not make routes issue ad hoc SQL.
5. Add tests for migrations, uniqueness, referential integrity, pagination, and failure handling.
6. Document local database setup, backup/restore expectations, and how schema changes are applied.

**Complete when:** catalog changes are reproducible, schema evolution is migration-controlled, and data survives app restarts.

### Stage 6 — Add accounts and private interactions

Only begin when the product needs per-person state and the storage foundation is ready.

1. Choose an authentication provider/approach and document the session/token and account lifecycle.
2. Define user-scoped interactions (save, like/dislike, rating, optional history) and retention/privacy expectations.
3. Derive identity from verified credentials; never trust a client-supplied user ID for private data access.
4. Implement authenticated endpoints and persist interactions with ownership constraints.
5. Add authorization tests, especially cross-user isolation and unauthenticated access.
6. Replace in-memory Library/Profile summaries with API-backed state; handle loading and sign-out.

**Complete when:** interactions survive refresh and sign-in on another device, and a user cannot access another user's private data.

### Stage 7 — Select and serve recommendations using evidence

1. Use the Stage 3 evaluation to select a simple baseline for a clearly defined task.
2. Separate offline training/evaluation from request-time inference.
3. Define a versioned recommendation request/response schema and deterministic fallback for cold start or missing model artifacts.
4. Move stable inference code into tested Python modules; notebooks remain the experiment record.
5. Version artifacts/configuration and record training data reference, split, metrics, and limitations.
6. Integrate through FastAPI and add route/service tests, latency/error handling, and explanation fields only where evidence supports them.
7. Measure relevance and catalog coverage; add diversity/novelty only with explicit evaluation.

**Complete when:** recommendations are generated by backend logic, repeatable, tested, and supported by a stated evaluation—not hardcoded frontend suggestions.

### Stage 8 — Make Taste Map data-driven

1. Specify node/edge types, directionality, provenance, confidence, and display rules.
2. Build relationships from catalog metadata or validated user/recommendation signals. Each edge must have traceable evidence.
3. Define deduplication by canonical endpoints and relationship type; preserve distinct meaningful relationships.
4. Scope personalization to the authenticated user's permitted data.
5. Implement accessible selection/navigation and tests for graph contents and updates.
6. Diagnose the current duplicate-looking straight edges against actual node/edge data before changing rendering behavior.

**Complete when:** the visualization reflects underlying records, updates when relevant data changes, and users can understand why displayed connections exist.

### Stage 9 — Expand sources and prepare for production

1. Review each source's terms, permitted use, attribution, rate limits, coverage, and caching before integrating it.
2. Implement idempotent ingestion, normalization, deduplication, provenance, retries, and observable run summaries.
3. Add backups, migration procedures, structured logs, secret management, CORS/origin restrictions, and privacy/security review.
4. Deploy frontend, API, and database as separate configured services; frontend hosting alone does not host FastAPI or create persistence.
5. Add deployment smoke checks and a runbook for release, rollback, data refresh, and incident recovery.
6. Expand categories/cross-media links only when there is sufficient licensed data and an evaluation or user-study plan.

**Complete when:** the system can be deployed, monitored, updated, and recovered without hand-editing frontend catalog data, and its documented claims match measured behavior.

## One-work-item loop

Use this cycle for every milestone:

1. Pick one user-visible or foundational outcome and state its acceptance criteria.
2. Check dependencies and current docs; update the contract/design before changing behavior.
3. Implement the smallest complete slice across affected layers.
4. Add focused checks for the changed behavior and run the relevant existing validation commands.
5. Review data/privacy/licensing implications when the change touches user data or an external source.
6. Update status, setup, API, and experiment documentation in the same change.
7. Commit/review the coherent slice, then choose the next unblocked item.

## Recommended immediate order

1. Reproduce the current frontend/backend checkpoint and write down any setup fixes.
2. Agree the first catalog fields and API response contract.
3. Implement and validate the small catalog API.
4. In parallel with step 3, rerun both MovieLens notebooks and add a sound top-K evaluation protocol.
5. Connect Discover to the API and verify the full vertical slice.
6. Only after the slice works, add database migrations; then accounts/interactions; then evaluated recommendations; then data-driven Taste Map; then broader ingestion and production operations.

## Scope guardrails

- Do not treat planned UI labels as implemented backend features.
- Do not call genre overlap or a notebook output a production/personalized cross-media model.
- Do not put raw datasets, credentials, or user-private data in Git.
- Do not add a graph database, vector database, microservices, or deep model until a measured need and evaluation justify them.
- Do not claim deployment of the complete system based on a frontend-only preview.
- Update `docs/PROJECT_STATUS.md` when implementation changes so this workflow remains anchored to reality.

## Related references

- [Project status](PROJECT_STATUS.md)
- [Implementation roadmap](roadmap.md)
- [Architecture](architecture.md)
- [Frontend guide](frontend.md)
- [Backend guide](backend.md)
- [ML roadmap](ml-roadmap.md)
- [Dataset register](dataset-register.md)
- [Notebooks guide](../notebooks/README.md)
