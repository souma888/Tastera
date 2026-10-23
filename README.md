# TASTERA

**Discover what connects you.** TASTERA is a cross-media discovery app for movies, books, and music. It helps people follow a title, creator, or shared catalog theme into another kind of media, with the reason for each pathway shown.

## Live application

- Frontend: [soumadip-tastera.vercel.app](https://soumadip-tastera.vercel.app)
- Backend API: [tastera.onrender.com](https://tastera.onrender.com)
- Interactive API documentation: [tastera.onrender.com/docs](https://tastera.onrender.com/docs)

The frontend is deployed on Vercel; the FastAPI backend runs on Render and uses Neon PostgreSQL. GitHub `main` is the deployment source. The API may take a short time to wake after inactivity.

## What the app does

- **Discover:** browse movies, books, and albums; search titles, creators, and genres; filter by category or genre; select 50, 100, or 150 items per page; and page through popularity-ordered results.
- **Follow connections:** open a catalog card or recommendation to see related cross-media items. Each link is labeled as a shared creator credit, exact normalized genre, shared word in Tastera editorial notes, or your own saved/feedback activity.
- **Creator pages:** collect catalog records that use the same creator credit, such as an author, director, or recording artist.
- **Taste Map:** trace saved items and recommendation feedback to their catalog genres. Select a genre to search matching catalog records; drag to pan, scroll to zoom, and inspect why nodes connect.
- **Personalize:** choose starter titles, artists, genres, and moods; view For You recommendations; refresh the batch; tune the Movies/Books/Music mix; and send “More like this” or “Not for me” feedback.
- **Library and Profile:** keep account-backed saved items and view category, genre, recent-save, and feedback summaries.
- **Collections:** make themed shelves and share a link. Collections currently live in the browser; a shared link carries a snapshot and does not sync later edits back to its owner.
- **Guide, About, Contact:** learn how the app works, what data powers it, and how to reach the developer.

Pathways use the metadata currently available. Genre and creator links are catalog evidence; overlapping editorial-theme words are interpretive. Setting and influence credits are not consistently present, so the app does not invent those connections. These pathways are explainable discovery links, not a trained cross-media recommender. For You is a transparent baseline with movie co-save ranking where available; it is not a fully evaluated ML model.

## Run locally

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Set `VITE_API_BASE_URL` in `frontend/.env.local` to `http://127.0.0.1:8000/api/v1` to use a local backend. See [frontend setup](docs/frontend.md).

### Backend

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m alembic upgrade head
python -m app.seed_catalog
uvicorn app.main:app --reload
```

The local default is SQLite. Set `TASTERA_DATABASE_URL` before migrations and startup to use PostgreSQL. Set a private `TASTERA_AUTH_SECRET` for account features and `TASTERA_CORS_ORIGINS` for browser origins as needed. Never commit secrets. API routes and import workflows are in the [backend guide](docs/backend.md).

## Project documentation

- [Project status and remaining work](docs/PROJECT_STATUS.md)
- [Implementation roadmap](docs/roadmap.md)
- [End-to-end workflow](docs/PROJECT_WORKFLOW.md)
- [Architecture](docs/architecture.md)
- [Frontend guide](docs/frontend.md)
- [Backend guide](docs/backend.md)
- [Recommendation research roadmap](docs/ml-roadmap.md)
- [Notebook guide](notebooks/README.md)
- [Dataset register](docs/dataset-register.md)

## Catalog data and attribution

TMDb, Open Library, MusicBrainz, and Cover Art Archive data are imported from separate manual workflows. TMDb requires a locally supplied `TMDB_READ_ACCESS_TOKEN`; normal browsing does not. Keep source dumps, private tokens, and user data out of Git. Review each provider’s current terms and attribution requirements before redistribution or commercial use. See the [dataset register](docs/dataset-register.md).

## License

No repository license is currently declared. Do not assume permission to reuse the code.
