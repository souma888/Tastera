"""Store Sentence Transformer embeddings for catalog items.

Revision ID: 20261026_08
Revises: 20261025_07
Create Date: 2026-10-26
"""

from alembic import op
import sqlalchemy as sa

from pgvector.sqlalchemy import Vector


revision = "20261026_08"
down_revision = "20261025_07"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
        embedding_type = Vector(384)
    else:
        # SQLite is for local app development. Semantic retrieval remains
        # PostgreSQL-only, but JSON storage lets migrations/tests use SQLite.
        embedding_type = sa.JSON()

    op.create_table(
        "media_embeddings",
        sa.Column(
            "media_item_id",
            sa.String(length=100),
            sa.ForeignKey("media_items.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("model_name", sa.String(length=200), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("embedding", embedding_type, nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_media_embeddings_model_name", "media_embeddings", ["model_name"])
    op.create_index("ix_media_embeddings_content_hash", "media_embeddings", ["content_hash"])
    if bind.dialect.name == "postgresql":
        op.create_index(
            "ix_media_embeddings_hnsw_cosine",
            "media_embeddings",
            ["embedding"],
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
            postgresql_with={"m": 16, "ef_construction": 64},
        )


def downgrade() -> None:
    op.drop_table("media_embeddings")
