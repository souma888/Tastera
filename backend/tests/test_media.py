import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_session
from app.main import app
from app.models.catalog import Genre, MediaGenre, MediaIdentifier, MediaItemRecord


@pytest.fixture
def client() -> TestClient:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    with testing_session() as session:
        genre = Genre(name="Science Fiction")
        session.add_all(
            [
                MediaItemRecord(
                    id="dune-book",
                    title="Dune",
                    creator="Frank Herbert",
                    category="Books",
                    primary_genre="Science Fiction",
                    artwork_url="https://example.test/dune.jpg",
                    connection="An epic science-fiction story.",
                    source="test",
                    identifiers=[MediaIdentifier(provider="test", external_id="dune")],
                    genre_links=[MediaGenre(genre=genre)],
                ),
                MediaItemRecord(
                    id="arrival",
                    title="Arrival",
                    creator="Denis Villeneuve",
                    category="Movies",
                    primary_genre="Science Fiction",
                    artwork_url="https://example.test/arrival.jpg",
                    connection="A story about language and time.",
                    source="test",
                    identifiers=[MediaIdentifier(provider="test", external_id="arrival")],
                    genre_links=[MediaGenre(genre=genre)],
                ),
            ]
        )
        session.commit()

    def override_get_session():
        session: Session = testing_session()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_session] = override_get_session
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_list_media_returns_paginated_catalog(client: TestClient) -> None:
    response = client.get("/api/v1/media")

    assert response.status_code == 200
    payload = response.json()
    assert payload["page"] == 1
    assert payload["limit"] == 20
    assert payload["total"] == 2
    assert payload["total_pages"] == 1
    assert payload["items"][0]["id"] == "arrival"


def test_list_media_filters_by_category_and_query(client: TestClient) -> None:
    response = client.get("/api/v1/media", params={"category": "Books", "q": "herbert"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["id"] == "dune-book"


def test_list_media_rejects_invalid_pagination(client: TestClient) -> None:
    response = client.get("/api/v1/media", params={"page": 0})

    assert response.status_code == 422


def test_get_media_by_stable_id(client: TestClient) -> None:
    response = client.get("/api/v1/media/dune-book")

    assert response.status_code == 200
    assert response.json()["title"] == "Dune"


def test_get_missing_media_returns_not_found(client: TestClient) -> None:
    response = client.get("/api/v1/media/not-real")

    assert response.status_code == 404
    assert response.json() == {"detail": "Media item not found."}
