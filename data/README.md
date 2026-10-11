# Data

TASTERA keeps datasets organized by provenance and processing stage. **Do not commit raw datasets, large generated datasets, secrets, or data that cannot be redistributed.** The repository's .gitignore excludes local data directories such as data/raw/, data/interim/, data/processed/, and data/external/.

## Directory convention

- raw/: original downloaded source files, unchanged.
- interim/: intermediate outputs used during documented transformation steps.
- processed/: validated outputs prepared for analysis or modeling.
- external/: other locally stored source data that have been reviewed for permitted use.

Create these directories locally when needed. Empty local data directories may not appear in Git because they are ignored.

## Current dataset: MovieLens Latest Small

Place the extracted files locally at:

```text
data/raw/movielens/ml-latest-small/
```

Expected files:

- movies.csv
- ratings.csv
- tags.csv
- links.csv

The audit notebook expects this path by default. Do not rename or edit the original files during the audit.

## Documentation and responsible use

- See docs/dataset-register.md for source provenance and license/terms notes.
- See docs/data-dictionary.md for field definitions and planned derived features.
- Check each provider's licensing, attribution, API terms, and commercial-use restrictions before use.
- Keep a record of the source URL, version or download date, retrieval method, schema, transformations, and applicable terms.
- Do not place API keys, credentials, private user data, or unapproved dataset copies in the repository.
