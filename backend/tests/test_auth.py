from types import SimpleNamespace

from fastapi import Response
from starlette.requests import Request

from app.api.v1 import auth
from app.schemas.accounts import Credentials


class _Session:
    def scalar(self, _query):
        return SimpleNamespace(password_hash="test-password-hash")


def test_successful_login_supports_rate_limit_response_headers(monkeypatch) -> None:
    """SlowAPI needs the endpoint's injected Response object on success."""

    monkeypatch.setenv("TASTERA_AUTH_SECRET", "test-secret-that-is-at-least-32-characters")
    monkeypatch.setattr(auth, "verify_password", lambda _password, _hash: True)
    monkeypatch.setattr(auth, "_auth_response", lambda _account: {"ok": True})

    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/v1/auth/login",
            "headers": [],
            "client": ("127.0.0.1", 12345),
        }
    )

    result = auth.login(
        request=request,
        response=Response(),
        credentials=Credentials(email="rate-limit-test@example.com", password="test-password"),
        session=_Session(),
    )

    assert result == {"ok": True}
