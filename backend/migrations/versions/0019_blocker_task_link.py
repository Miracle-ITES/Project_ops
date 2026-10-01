"""link tickets to tasks

Revision ID: 0019_blocker_task_link
Revises: 0018_issue_blocker_escalation
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "0019_blocker_task_link"
down_revision = "0018_issue_blocker_escalation"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("blockers", sa.Column("task_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_blockers_task_id_tasks", "blockers", "tasks", ["task_id"], ["id"], ondelete="SET NULL",
    )
    op.create_index("ix_blockers_task_id", "blockers", ["task_id"])


def downgrade():
    op.drop_index("ix_blockers_task_id", table_name="blockers")
    op.drop_constraint("fk_blockers_task_id_tasks", "blockers", type_="foreignkey")
    op.drop_column("blockers", "task_id")
