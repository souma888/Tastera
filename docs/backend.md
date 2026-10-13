# Backend Guide

## Current status

The backend is an early FastAPI foundation. It currently exposes `GET /health`, and `backend/tests/test_health.py` tests that endpoint. Catalog routes, database models, authentication, user interactions, and recommendation inference are not implemented.

## Local setup

From the repository root, use a supported Python version and create a virtual environment:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload
```

If PowerShell blocks virtual-environment activation, use Command Prompt activation or the appropriate session-only execution-policy workaround. Run commands from `backend/` so that `app.main:app` resolves.

- Health check: `http://127.0.0.1:8000/health`
- Interactive API documentation: `http://127.0.0.1:8000/docs`
- OpenAPI schema: `http://127.0.0.1:8000/openapi.json`

## Tests

From `backend/` with the virtual environment active:

```powershell
pytest
```

The test suite is small at this stage. Add tests for validation, error cases, database behavior, permissions, and recommendation contracts as those components are implemented.

## Recommended structure

```text
backend/app/
├── main.py
├── api/v1/          # HTTP route handlers
├── core/            # settings, security, shared configuration
├── models/          # database models
├── schemas/         # request/response validation schemas
├── services/        # application/business logic
└── recommender/     # inference adapters, not training notebooks
```

This is a proposed structure. Existing `.gitkeep` placeholders do not indicate implemented modules.

## API conventions

- Use a versioned prefix such as `/api/v1` for application endpoints.
- Keep health checks separate from product API routes.
- Validate incoming values with Pydantic schemas.
- Use pagination and deterministic ordering for catalog endpoints.
- Return consistent errors and never expose internal tracebacks or secrets.
- Add explicit tests for invalid parameters and missing records.
- Once accounts exist, derive the acting user from validated authentication, not from a user ID supplied by the client.
- Configure allowed CORS origins explicitly for deployment.

## First useful product endpoint

Implement a paginated catalog endpoint after defining the canonical media schema. A possible contract is:

```http
GET /api/v1/media?category=Movies&q=space&page=1&limit=20
```

This is an example contract, not an existing route. Document allowed categories, query behavior, ordering, pagination fields, and error responses when implementing it.

## Configuration and secrets

Use environment variables for deployment-specific configuration. Do not commit API keys, database passwords, tokens, private datasets, or production environment files. Add a safe `.env.example` only when configuration variables are introduced.
