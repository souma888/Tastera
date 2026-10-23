# TASTERA Documentation

These documents describe the deployed product, architecture, data provenance, research, and remaining work. Cross-media pathways and creator/theme exploration are shipped as metadata-based discovery tools; cross-media preference prediction is not claimed.

## Product and development

- [End-to-end workflow](PROJECT_WORKFLOW.md) — current development priorities and operating notes.
- [Project status](PROJECT_STATUS.md) — shipped capabilities, limitations, and remaining work.
- [Implementation roadmap](roadmap.md) — completed milestones and next product/reliability work.
- [Architecture](architecture.md) — browser-to-API flow and relationship evidence model.
- [Frontend guide](frontend.md) — React/Vite setup and shipped interface behavior.
- [Backend guide](backend.md) — FastAPI setup, API routes, and import commands.

## Data and research

- [Dataset register](dataset-register.md) — source provenance, usage, and attribution notes.
- [Data dictionary](data-dictionary.md) — MovieLens source fields and derived-feature notes.
- [ML roadmap](ml-roadmap.md) — MovieLens evaluation and recommender development.
- [MovieLens audit](experiments/01-movielens-audit.md) — audit method and recorded results.
- [Baseline recommender experiment](experiments/02-baseline-recommenders.md) — research baselines and evaluation notes.
- [Notebook guide](../notebooks/README.md) — notebook order and reproducibility.

## Documentation rules

- Describe shipped behavior separately from planned work.
- Explain whether a relationship comes from catalog metadata, editorial interpretation, or user activity.
- Record observed experiment results and exact splits; mark unrun checks as pending.
- Keep credentials, raw datasets, and private account data out of Git.
- Update project status and affected setup/API guides when behavior changes.
