"""Account and per-user saved catalog records."""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AccountRecord(Base):
    """A TASTERA account authenticated by email and password."""

    __tablename__ = "accounts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    saved_media: Mapped[list["SavedMediaRecord"]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )
    recommendation_feedback: Mapped[list["RecommendationFeedbackRecord"]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )


class SavedMediaRecord(Base):
    """A media item saved by one account."""

    __tablename__ = "saved_media"
    __table_args__ = (
        UniqueConstraint("account_id", "media_item_id", name="uq_saved_media_account_item"),
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

    account: Mapped[AccountRecord] = relationship(back_populates="saved_media")
    media_item: Mapped["MediaItemRecord"] = relationship()


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
