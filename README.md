# TASTERA

**Discover what connects you.** TASTERA is a cross-media discovery app for movies, books, and music. Its long-term goal is to help people find meaningful connections across the things they enjoy.

## Live application

- Frontend: [soumadip-tastera.vercel.app](https://soumadip-tastera.vercel.app)
- Backend API: [tastera.onrender.com](https://tastera.onrender.com)
- API documentation: [tastera.onrender.com/docs](https://tastera.onrender.com/docs)

The frontend is deployed on Vercel; the FastAPI backend runs on Render and uses Neon PostgreSQL. GitHub `main` is the deployment source. A live deployment can take a short time to wake after inactivity.

## Current product

- Discover catalog browsing with category filters, search, pagination, media artwork, and offline demo fallback.
- Account registration and sign-in. Passwords are Argon2-hashed; signed bearer sessions expire after 12 hours.
- Account-scoped saved media in the Library.
- For You recommendations based on saved genres, with persisted “More like this” and “Not for me” feedback.
- Movies, Books, and Music catalog records. Movie ingestion from TMDb is a manual backend operation.
- Taste Map and Profile entry points, which are still prototypes/placeholders.

Recommendations are a transparent genre-weighting baseline, not a trained or evaluated machine-learning model. Cross-media recommendations, a dynamic Taste Map, and a complete profile are future work. See [current status](docs/PROJECT_STATUS.md) for limitations and the user-prioritized next steps.

## Run locally

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Set `VITE_API_BASE_URL` in `frontend/.env.local` to `http://127.0.0.1:8000/api/v1` to use a local backend. Without it, the client uses its configured default. See [frontend setup](docs/frontend.md).

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

The local default is SQLite. Set `TASTERA_DATABASE_URL` before migrations and startup to use PostgreSQL. Set a private `TASTERA_AUTH_SECRET` for account features and `TASTERA_CORS_ORIGINS` for browser origins as needed. Never commit secrets. Details and API routes are in the [backend guide](docs/backend.md).

## Project documentation

- [Project status and next steps](docs/PROJECT_STATUS.md)
- [Implementation roadmap](docs/roadmap.md)
- [End-to-end workflow](docs/PROJECT_WORKFLOW.md)
- [Architecture](docs/architecture.md)
- [Frontend guide](docs/frontend.md)
- [Backend guide](docs/backend.md)
- [Recommendation research roadmap](docs/ml-roadmap.md)
- [Notebook guide](notebooks/README.md)

## Project scope

The deployed app is a working early product, while the broader vision includes personalized cross-media discovery, explainable connections, and a taste profile that evolves with user activity. Current priorities are completing Profile, improving Books and Music coverage, and adding a refresh action for For You. The [roadmap](docs/roadmap.md) distinguishes shipped functionality from unfinished work.

## Data and attribution

The TMDb importer requires a locally supplied `TMDB_READ_ACCESS_TOKEN`; normal app browsing does not. Follow TMDb's current terms and attribution requirements before importing or distributing metadata. MovieLens files used for experiments should remain outside Git and follow their dataset terms. See the [dataset register](docs/dataset-register.md).

## License

No repository license is currently declared. Do not assume permission to reuse the code.
