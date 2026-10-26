# Free-tier feature workflow

These additions use the current static Vercel frontend, the existing Render API, and the existing Neon PostgreSQL database. They do not add a paid model API, persistent worker, scheduled job, hosted vector service, or mail provider. Catalog imports are manual and run only when requested.

## Deploy the application changes

1. Push the code to `main`; Vercel and Render use the existing GitHub deployment setup.
2. The Render startup command already applies pending Alembic migrations before starting FastAPI. If the service uses a different start command, run `python -m alembic upgrade head` once with its production `TASTERA_DATABASE_URL` before serving requests.
3. New social data is small relational data in Neon. Public profiles are opt-in; Library entries, ratings, and notes are not exposed by the social endpoints.
4. The PWA caches only the static app shell. It never caches `/api/` responses or signed-in data. After the first online visit, the app shell can open offline; live catalog and account actions need a connection.

## Import media on demand

Run these from `backend/` with the production database URL configured in the current shell, or use a local database for a trial. Do not save production credentials in the repository or commit `.env` files.

```powershell
python -m alembic upgrade head
python -m app.import_tmdb --media-type movie --pages 1 --watch-region IN
python -m app.import_tmdb --media-type tv --pages 1 --watch-region IN
python -m app.import_podcasts --limit 50
python -m app.import_games --limit 100
python -m app.embed_catalog
```

- TMDb imports need the existing `TMDB_READ_ACCESS_TOKEN`. Movie and TV imports save the regional TMDb watch-options link; the provider list can change and the link is region-scoped. Attribute JustWatch/TMDb when displaying this availability data.
- Podcast metadata uses Apple's public iTunes Search API and needs no API key.
- Games use the IGDB API. Its developer docs describe non-commercial access as free, but require a Twitch developer application. Set `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET` only in your local shell or secret manager. Do not run the importer automatically during Render startup.
- Keep import batches small on the free service. Catalog loading and embedding generation use memory and database capacity; prefer running `app.embed_catalog` locally against the production Neon URL when a batch is large.

## User data imports

Signed-in users can select Letterboxd, Goodreads, or Spotify as the export format in Library. The browser parses a CSV/JSON file in memory, matches title and creator against the catalog, displays a preview, then sends only the chosen matched item IDs to the existing save API. The raw export is not uploaded or retained. Unmatched titles need to exist in the catalog first; this is not a direct provider OAuth connection.

## Adaptation and creator-alias data

Only add factual links after a human has checked their sources. Prepare UTF-8 CSV files and run:

```powershell
python -m app.import_catalog_links --relationships reviewed_relationships.csv --aliases reviewed_aliases.csv
```

Relationship columns: `source_id,target_id,type,provenance,source_url,confidence`. Alias columns: `alias,canonical_name,provenance,source_url`. This stores the original creator credit and exposes a source-attributed relationship through the connection explorer. No automated model is allowed to turn a semantic match into a factual adaptation or shared identity.

## Free-tier behavior and boundaries

- Surprise Me runs in the browser against the catalog already loaded for the page.
- There is no weekly email digest because a reliable scheduled sender would require an external mail service or always-on job.
- Collection sharing and follows use the existing API/database. Collections are private by default; sharing switches one collection to public, and “Make private” revokes its share page.
- Free service instances may sleep and need time to wake. No new background worker is required.
