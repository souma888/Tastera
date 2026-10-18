# TASTERA Documentation

Use these documents to understand the current implementation, design decisions, research, and next steps. The repository is still an early prototype; proposed architecture and unchecked roadmap items are not implemented features.

## Start here

- [End-to-end project workflow](PROJECT_WORKFLOW.md) — the ordered execution plan, gates, and immediate next actions.
- [Project status](PROJECT_STATUS.md) — implemented features, limitations, and immediate priorities.
- [Architecture](architecture.md) — current data flow and proposed target architecture.
- [Implementation roadmap](roadmap.md) — milestones with acceptance criteria.

## Development guides

- [Frontend guide](frontend.md) — React/Vite setup, current behavior, and API integration plan.
- [Backend guide](backend.md) — FastAPI setup, tests, and API conventions.
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
