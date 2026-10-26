"""Account and per-user saved catalog records."""

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AccountRecord(Base):
    """A TASTERA account authenticated by email and password."""

    __tablename__ = "accounts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    public_profile: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    saved_media: Mapped[list["SavedMediaRecord"]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )
    recommendation_feedback: Mapped[list["RecommendationFeedbackRecord"]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )


class CollectionRecord(Base):
    __tablename__ = "collections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    visibility: Mapped[str] = mapped_column(String(12), nullable=False, default="private")
    share_slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CollectionItemRecord(Base):
    __tablename__ = "collection_items"

    collection_id: Mapped[str] = mapped_column(ForeignKey("collections.id", ondelete="CASCADE"), primary_key=True)
    media_item_id: Mapped[str] = mapped_column(ForeignKey("media_items.id", ondelete="CASCADE"), primary_key=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class AccountFollowRecord(Base):
    __tablename__ = "account_follows"
    __table_args__ = (CheckConstraint("follower_id != followed_id", name="ck_no_self_follow"),)

    follower_id: Mapped[str] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True)
    followed_id: Mapped[str] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SavedMediaRecord(Base):
    """A media item saved by one account."""

    __tablename__ = "saved_media"
    __table_args__ = (
        UniqueConstraint("account_id", "media_item_id", name="uq_saved_media_account_item"),
        CheckConstraint("status in ('planned', 'in_progress', 'finished')", name="ck_saved_media_status"),
        CheckConstraint("rating is null or rating between 1 and 5", name="ck_saved_media_rating"),
        CheckConstraint("progress_percent is null or progress_percent between 0 and 100", name="ck_saved_media_progress"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[str] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), index=True
    )
    media_item_id: Mapped[str] = mapped_column(
        ForeignKey("media_items.id", ondelete="CASCADE"), index=True
    )
    saved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="planned")
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    progress_percent: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    account: Mapped[AccountRecord] = relationship(back_populates="saved_media")
    media_item: Mapped["MediaItemRecord"] = relationship()


class LibraryActivityRecord(Base):
    """A private timeline event for one account's Library."""

    __tablename__ = "library_activity"

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[str] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), index=True
    )
    media_item_id: Mapped[str] = mapped_column(
        ForeignKey("media_items.id", ondelete="CASCADE"), index=True
    )
    event_type: Mapped[str] = mapped_column(String(20), nullable=False)
    value: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )


class RecommendationFeedbackRecord(Base):
    """A per-account signal that an item is a good or poor recommendation."""

    __tablename__ = "recommendation_feedback"
    __table_args__ = (
        CheckConstraint("feedback in ('more', 'less')", name="ck_feedback_value"),
    )

    account_id: Mapped[str] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True
    )
    media_item_id: Mapped[str] = mapped_column(
        ForeignKey("media_items.id", ondelete="CASCADE"), primary_key=True
    )
    feedback: Mapped[str] = mapped_column(String(10), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    account: Mapped[AccountRecord] = relationship(back_populates="recommendation_feedback")
    media_item: Mapped["MediaItemRecord"] = relationship()
