"""add missing performance indexes for project and task list queries

Revision ID: 0009_indexes_for_lists
Revises: 0008_invitation_requests
"""

import sqlalchemy as sa
from alembic import op

revision = "0009_indexes_for_lists"
down_revision = "0008_invitation_requests"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index("ix_projects_created_at", "projects", ["created_at"])
    op.create_index("ix_tasks_created_at", "tasks", ["created_at"])


def downgrade():
    op.drop_index("ix_tasks_created_at", table_name="tasks")
    op.drop_index("ix_projects_created_at", table_name="projects")
