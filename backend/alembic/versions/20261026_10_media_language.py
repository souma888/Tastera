"""Add language metadata to catalog items.

Revision ID: 20261026_10
Revises: 20261026_09
Create Date: 2026-10-26
"""

from alembic import op
import sqlalchemy as sa


revision = "20261026_10"
down_revision = "20261026_09"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("media_items", sa.Column("language", sa.String(length=40), nullable=True))
    op.create_index("ix_media_items_language", "media_items", ["language"])


def downgrade() -> None:
    op.drop_index("ix_media_items_language", table_name="media_items")
    op.drop_column("media_items", "language")
