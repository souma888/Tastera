"""Database engine and session lifecycle."""

from collections.abc import Generator
from os import getenv

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


DATABASE_URL = getenv("TASTERA_DATABASE_URL", "sqlite:///./tastera.db")
engine_options: dict[str, object] = {}
if DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """Base class for persistent TASTERA models."""


def get_session() -> Generator[Session, None, None]:
    """Provide one database session for a request."""

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
