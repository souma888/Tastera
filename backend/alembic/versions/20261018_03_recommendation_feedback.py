"""Persist per-account recommendation feedback.

Revision ID: 20261018_03
Revises: 20261018_02
Create Date: 2026-10-18
"""

from alembic import op
import sqlalchemy as sa


revision = "20261018_03"
down_revision = "20261018_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "recommendation_feedback",
        sa.Column("account_id", sa.String(length=36), nullable=False),
        sa.Column("media_item_id", sa.String(length=100), nullable=False),
        sa.Column("feedback", sa.String(length=10), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("feedback in ('more', 'less')", name="ck_feedback_value"),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["media_item_id"], ["media_items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("account_id", "media_item_id"),
    )


def downgrade() -> None:
    op.drop_table("recommendation_feedback")
