"""Create canonical catalog tables.

Revision ID: 20261018_01
Revises:
Create Date: 2026-10-18
"""

from alembic import op
import sqlalchemy as sa


revision = "20261018_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "media_items",
        sa.Column("id", sa.String(length=100), primary_key=True),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("creator", sa.String(length=500), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("primary_genre", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("artwork_url", sa.Text(), nullable=False),
        sa.Column("connection", sa.Text(), nullable=False),
        sa.Column("source", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_media_items_title", "media_items", ["title"])
    op.create_index("ix_media_items_creator", "media_items", ["creator"])
    op.create_index("ix_media_items_category", "media_items", ["category"])
    op.create_index("ix_media_items_primary_genre", "media_items", ["primary_genre"])

    op.create_table(
        "genres",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False, unique=True),
    )
    op.create_table(
        "media_identifiers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("media_item_id", sa.String(length=100), nullable=False),
        sa.Column("provider", sa.String(length=100), nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(["media_item_id"], ["media_items.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("provider", "external_id"),
    )
    op.create_index("ix_media_identifiers_media_item_id", "media_identifiers", ["media_item_id"])
    op.create_table(
        "media_genres",
        sa.Column("media_item_id", sa.String(length=100), nullable=False),
        sa.Column("genre_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["media_item_id"], ["media_items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["genre_id"], ["genres.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("media_item_id", "genre_id"),
    )


def downgrade() -> None:
    op.drop_table("media_genres")
    op.drop_index("ix_media_identifiers_media_item_id", table_name="media_identifiers")
    op.drop_table("media_identifiers")
    op.drop_table("genres")
    op.drop_index("ix_media_items_primary_genre", table_name="media_items")
    op.drop_index("ix_media_items_category", table_name="media_items")
    op.drop_index("ix_media_items_creator", table_name="media_items")
    op.drop_index("ix_media_items_title", table_name="media_items")
    op.drop_table("media_items")
