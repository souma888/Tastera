# TASTERA Backend

FastAPI service foundation for the TASTERA discovery platform.

## Current implementation

- `app/main.py`: creates the FastAPI application.
- `GET /health`: returns a lightweight service health response.
- `tests/test_health.py`: tests the health endpoint.

Catalog APIs, database integration, authentication, user interactions, and recommendation serving are not implemented yet. See [project status](../docs/PROJECT_STATUS.md) and the [backend guide](../docs/backend.md).

## Requirements

Python and the packages in `requirements.txt`. A virtual environment is recommended.

## Run locally

From the repository root:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/health` for the health check and `http://127.0.0.1:8000/docs` for interactive API documentation.

## Test

With the virtual environment active and current directory set to `backend/`:

```powershell
pytest
```

## Development conventions

- Add product endpoints under a versioned prefix such as `/api/v1`.
- Use Pydantic schemas for request and response validation.
- Keep business logic in services rather than route handlers.
- Add tests with each endpoint.
- Never commit secrets or production environment files.
