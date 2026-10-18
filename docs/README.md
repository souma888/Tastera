# TASTERA Documentation

Use these documents to understand the deployed product, design decisions, research, and remaining work. The app is live, while parts of the broader cross-media vision remain planned.

## Start here

- [End-to-end project workflow](PROJECT_WORKFLOW.md) — the current work order and development loop.
- [Project status](PROJECT_STATUS.md) — implemented features, limitations, and immediate priorities.
- [Architecture](architecture.md) — deployed data flow and future direction.
- [Implementation roadmap](roadmap.md) — shipped foundation and remaining product/operational work.

## Development guides

- [Frontend guide](frontend.md) — React/Vite setup and current behavior.
- [Backend guide](backend.md) — FastAPI setup, routes, and configuration.
- [Notebooks guide](../notebooks/README.md) — research notebook workflow and reproducibility.

## Data and ML research

- [Dataset register](dataset-register.md) — data source provenance and restrictions.
- [Data dictionary](data-dictionary.md) — dataset fields and planned derived features.
- [ML roadmap](ml-roadmap.md) — validation, baseline evaluation, ranking, and cross-media research.
- [MovieLens audit](experiments/01-movielens-audit.md) — audit method and recorded findings.
- [Baseline recommender experiment](experiments/02-baseline-recommenders.md) — current baseline methods and experiment notes.

## Documentation rules

- Mark planned work as planned; do not describe it as implemented.
- Record actual experimental findings and exact evaluation splits. Mark unrun checks as pending.
- Include setup commands that match the current repository and package scripts.
- Record dataset source, version/date, usage terms, preprocessing, and limitations.
- Keep credentials, private data, and raw datasets out of Git.
- Update project status when a milestone is completed, and update the relevant technical guide when behavior or setup changes.
