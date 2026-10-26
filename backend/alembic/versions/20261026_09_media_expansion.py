"""Add metadata fields and lightweight relationship tables.

Revision ID: 20261026_09
Revises: 20261026_08
"""
from alembic import op
import sqlalchemy as sa

revision = "20261026_09"
down_revision = "20261026_08"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("media_items", sa.Column("watch_url", sa.Text(), nullable=True))
    op.add_column("media_items", sa.Column("provider_region", sa.String(length=8), nullable=True))
    op.add_column("accounts", sa.Column("display_name", sa.String(length=80), nullable=True))
    op.add_column("accounts", sa.Column("public_profile", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_table(
        "collections",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("owner_id", sa.String(length=36), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("visibility", sa.String(length=12), nullable=False, server_default="private"),
        sa.Column("share_slug", sa.String(length=64), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "collection_items",
        sa.Column("collection_id", sa.String(length=36), sa.ForeignKey("collections.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("media_item_id", sa.String(length=100), sa.ForeignKey("media_items.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_table(
        "account_follows",
        sa.Column("follower_id", sa.String(length=36), sa.ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("followed_id", sa.String(length=36), sa.ForeignKey("accounts.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("follower_id != followed_id", name="ck_no_self_follow"),
    )
    op.create_table(
        "media_relationships",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_media_id", sa.String(length=100), sa.ForeignKey("media_items.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("target_media_id", sa.String(length=100), sa.ForeignKey("media_items.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("relationship_type", sa.String(length=40), nullable=False),
        sa.Column("provenance", sa.String(length=200), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="1"),
        sa.UniqueConstraint("source_media_id", "target_media_id", "relationship_type", name="uq_media_relationship"),
    )
    op.create_table(
        "creator_aliases",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("canonical_name", sa.String(length=500), nullable=False, index=True),
        sa.Column("alias", sa.String(length=500), nullable=False, unique=True),
        sa.Column("provenance", sa.String(length=200), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("account_follows")
    op.drop_table("collection_items")
    op.drop_table("collections")
    op.drop_column("accounts", "public_profile")
    op.drop_column("accounts", "display_name")
    op.drop_table("creator_aliases")
    op.drop_table("media_relationships")
    op.drop_column("media_items", "provider_region")
    op.drop_column("media_items", "watch_url")
