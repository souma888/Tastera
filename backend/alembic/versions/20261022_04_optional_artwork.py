"""Allow catalog records without artwork when reuse rights are unknown.

Revision ID: 20261022_04
Revises: 20261018_03
Create Date: 2026-10-22
"""

from alembic import op
import sqlalchemy as sa


revision = "20261022_04"
down_revision = "20261018_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "media_items",
        "artwork_url",
        existing_type=sa.Text(),
        nullable=True,
    )


def downgrade() -> None:
    op.execute(
        "UPDATE media_items SET artwork_url = "
        "'https://placehold.co/500x750/17121e/eee?text=No+Artwork' "
        "WHERE artwork_url IS NULL"
    )
    op.alter_column(
        "media_items",
        "artwork_url",
        existing_type=sa.Text(),
        nullable=False,
    )
