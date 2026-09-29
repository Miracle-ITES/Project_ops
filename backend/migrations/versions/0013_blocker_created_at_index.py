"""index blocker timeline ordering

Revision ID: 0013_blocker_created_at_index
Revises: 0012_task_backlog_status
"""
from alembic import op


revision = "0013_blocker_created_at_index"
down_revision = "0012_task_backlog_status"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index("ix_blockers_created_at", "blockers", ["created_at"])


def downgrade():
    op.drop_index("ix_blockers_created_at", table_name="blockers")
