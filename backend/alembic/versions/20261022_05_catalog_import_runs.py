"""Track catalog importer run status and item counts.

Revision ID: 20261022_05
Revises: 20261022_04
Create Date: 2026-10-22
"""

from alembic import op
import sqlalchemy as sa


revision = "20261022_05"
down_revision = "20261022_04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "catalog_import_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("provider", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("added", sa.Integer(), server_default="0", nullable=False),
        sa.Column("updated", sa.Integer(), server_default="0", nullable=False),
        sa.Column("skipped", sa.Integer(), server_default="0", nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
    )
    op.create_index("ix_catalog_import_runs_provider", "catalog_import_runs", ["provider"])
    op.create_index("ix_catalog_import_runs_status", "catalog_import_runs", ["status"])


def downgrade() -> None:
    op.drop_index("ix_catalog_import_runs_status", table_name="catalog_import_runs")
    op.drop_index("ix_catalog_import_runs_provider", table_name="catalog_import_runs")
    op.drop_table("catalog_import_runs")
