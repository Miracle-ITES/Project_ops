"""add blocker assignee

Revision ID: 0011_blocker_assignment
Revises: 0010_task_project_scope
"""
import sqlalchemy as sa
from alembic import op


revision = "0011_blocker_assignment"
down_revision = "0010_task_project_scope"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("blockers", sa.Column("assignee_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_blockers_assignee_id_users",
        "blockers",
        "users",
        ["assignee_id"],
        ["id"],
    )
    op.create_index("ix_blockers_assignee_id", "blockers", ["assignee_id"])


def downgrade():
    op.drop_index("ix_blockers_assignee_id", table_name="blockers")
    op.drop_constraint("fk_blockers_assignee_id_users", "blockers", type_="foreignkey")
    op.drop_column("blockers", "assignee_id")
