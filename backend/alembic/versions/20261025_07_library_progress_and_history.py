"""Add Library statuses, ratings, notes, progress, and activity history.

Revision ID: 20261025_07
Revises: 20261023_06
Create Date: 2026-10-25
"""

from alembic import op
import sqlalchemy as sa


revision = "20261025_07"
down_revision = "20261023_06"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("saved_media") as batch_op:
        batch_op.add_column(
            sa.Column("status", sa.String(length=20), server_default="planned", nullable=False)
        )
        batch_op.add_column(sa.Column("rating", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("note", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("progress_percent", sa.Integer(), nullable=True))
        batch_op.add_column(
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False)
        )
        batch_op.create_check_constraint(
            "ck_saved_media_status", "status in ('planned', 'in_progress', 'finished')"
        )
        batch_op.create_check_constraint(
            "ck_saved_media_rating", "rating is null or rating between 1 and 5"
        )
        batch_op.create_check_constraint(
            "ck_saved_media_progress", "progress_percent is null or progress_percent between 0 and 100"
        )
    op.create_table(
        "library_activity",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "account_id",
            sa.String(length=36),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "media_item_id",
            sa.String(length=100),
            sa.ForeignKey("media_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(length=20), nullable=False),
        sa.Column("value", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_library_activity_account_id", "library_activity", ["account_id"])
    op.create_index("ix_library_activity_media_item_id", "library_activity", ["media_item_id"])
    op.create_index("ix_library_activity_created_at", "library_activity", ["created_at"])
    op.create_index(
        "ix_library_activity_account_created",
        "library_activity",
        ["account_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_library_activity_account_created", table_name="library_activity")
    op.drop_index("ix_library_activity_created_at", table_name="library_activity")
    op.drop_index("ix_library_activity_media_item_id", table_name="library_activity")
    op.drop_index("ix_library_activity_account_id", table_name="library_activity")
    op.drop_table("library_activity")
    with op.batch_alter_table("saved_media") as batch_op:
        batch_op.drop_constraint("ck_saved_media_progress", type_="check")
        batch_op.drop_constraint("ck_saved_media_rating", type_="check")
        batch_op.drop_constraint("ck_saved_media_status", type_="check")
        batch_op.drop_column("updated_at")
        batch_op.drop_column("progress_percent")
        batch_op.drop_column("note")
        batch_op.drop_column("rating")
        batch_op.drop_column("status")
