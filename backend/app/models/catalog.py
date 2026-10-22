"""Persistent catalog models."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class MediaItemRecord(Base):
    """Canonical record for a movie, book, music release, or future media type."""

    __tablename__ = "media_items"

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    title: Mapped[str] = mapped_column(String(500), index=True)
    creator: Mapped[str] = mapped_column(String(500), index=True)
    category: Mapped[str] = mapped_column(String(50), index=True)
    primary_genre: Mapped[str] = mapped_column(String(100), index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    artwork_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    connection: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    identifiers: Mapped[list["MediaIdentifier"]] = relationship(
        back_populates="media_item", cascade="all, delete-orphan"
    )
    genre_links: Mapped[list["MediaGenre"]] = relationship(
        back_populates="media_item", cascade="all, delete-orphan"
    )


class MediaIdentifier(Base):
    """Provider identifier associated with a canonical catalog record."""

    __tablename__ = "media_identifiers"
    __table_args__ = (UniqueConstraint("provider", "external_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    media_item_id: Mapped[str] = mapped_column(
        ForeignKey("media_items.id", ondelete="CASCADE"), index=True
    )
    provider: Mapped[str] = mapped_column(String(100))
    external_id: Mapped[str] = mapped_column(String(255))

    media_item: Mapped[MediaItemRecord] = relationship(back_populates="identifiers")


class Genre(Base):
    """Normalized genre label."""

    __tablename__ = "genres"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)

    media_links: Mapped[list["MediaGenre"]] = relationship(back_populates="genre")


class MediaGenre(Base):
    """Many-to-many link between catalog records and genres."""

    __tablename__ = "media_genres"

    media_item_id: Mapped[str] = mapped_column(
        ForeignKey("media_items.id", ondelete="CASCADE"), primary_key=True
    )
    genre_id: Mapped[int] = mapped_column(
        ForeignKey("genres.id", ondelete="CASCADE"), primary_key=True
    )

    media_item: Mapped[MediaItemRecord] = relationship(back_populates="genre_links")
    genre: Mapped[Genre] = relationship(back_populates="media_links")


class CatalogImportRunRecord(Base):
    """Auditable counts and outcome for one catalog import execution."""

    __tablename__ = "catalog_import_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    provider: Mapped[str] = mapped_column(String(100), index=True)
    status: Mapped[str] = mapped_column(String(20), index=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    added: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    updated: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    skipped: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
