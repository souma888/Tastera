"""Add accounts and per-user saved media.

Revision ID: 20261018_02
Revises: 20261018_01
Create Date: 2026-10-18
"""

from alembic import op
import sqlalchemy as sa


revision = "20261018_02"
down_revision = "20261018_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "accounts",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("email", name="uq_accounts_email"),
    )
    op.create_table(
        "saved_media",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("account_id", sa.String(length=36), nullable=False),
        sa.Column("media_item_id", sa.String(length=100), nullable=False),
        sa.Column("saved_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["media_item_id"], ["media_items.id"], ondelete="CASCADE"),
        sa.UniqueConstraint(
            "account_id", "media_item_id", name="uq_saved_media_account_item"
        ),
    )
    op.create_index("ix_saved_media_account_id", "saved_media", ["account_id"])
    op.create_index("ix_saved_media_media_item_id", "saved_media", ["media_item_id"])


def downgrade() -> None:
    op.drop_index("ix_saved_media_media_item_id", table_name="saved_media")
    op.drop_index("ix_saved_media_account_id", table_name="saved_media")
    op.drop_table("saved_media")
    op.drop_table("accounts")
