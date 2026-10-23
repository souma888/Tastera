"""Store normalized catalog popularity scores.

Revision ID: 20261023_06
Revises: 20261022_05
Create Date: 2026-10-23
"""

from alembic import op
import sqlalchemy as sa


revision = "20261023_06"
down_revision = "20261022_05"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "media_items",
        sa.Column("popularity_score", sa.Float(), server_default="0", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("media_items", "popularity_score")
