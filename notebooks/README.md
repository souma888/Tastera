# Notebooks

This directory contains reproducible analysis and experiments for TASTERA. Notebooks preserve the reasoning, code, outputs, visualizations, findings, limitations, and next steps behind data and model decisions.

## Conventions

- Use numbered filenames to show the intended execution order, for example 01_dataset_audit.ipynb.
- Start with the objective, context, dataset provenance, assumptions, and environment.
- Keep cells focused and explain non-obvious decisions in Markdown.
- Run notebooks from top to bottom before committing them. Clear stale or excessively large outputs; retain useful compact tables and plots when they help readers understand the findings.
- Record actual findings, not anticipated results. Mark unrun sections as pending.
- Keep raw datasets outside notebook files and out of Git. Use paths under data/raw/ and document required local files.
- Prefer relative paths and deterministic settings where appropriate. Record package versions and random seeds for experiments that use randomness.
- Avoid secrets, private user data, and unnecessary large embedded outputs.
- Once an experiment becomes stable production logic, move reusable implementation into a Python module and test it; notebooks should remain the research record.

## Current execution order

| Notebook | Purpose | Status |
|---|---|---|
| `01_dataset_audit.ipynb` | Inspect MovieLens schemas, quality, ID consistency, ratings, genres, tags and identifier coverage | Recorded audit and follow-up validation outputs exist. Rerun locally if the dataset changes or to verify the current environment. |
| `02_baseline_recommenders.ipynb` | Compare rating-prediction baselines and evaluate popularity, genre-content and item-item collaborative ranking | Executed against the current local MovieLens Latest Small files. It records a per-user chronological test holdout plus a separate validation-only hyperparameter comparison. See `docs/experiments/02-baseline-recommenders.md`. |

## Related documentation

- docs/dataset-register.md: source provenance and usage restrictions
- docs/data-dictionary.md: source fields and planned derived features
- docs/experiments/01-movielens-audit.md: audit objective, method, findings and decisions
- docs/experiments/02-baseline-recommenders.md: baseline methods, split design, metrics and limitations

## Running

From the repository root, activate the project virtual environment and launch Jupyter:

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install -r notebooks/requirements.txt
python -m jupyter notebook
```

If PowerShell blocks activation, use the session-only execution-policy workaround documented in the project setup workflow, or use Command Prompt activation. Ensure the required analysis packages are installed in the active environment.
