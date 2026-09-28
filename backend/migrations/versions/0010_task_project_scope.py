"""link tasks to projects for scoped visibility and assignment

Revision ID: 0010_task_project_scope
Revises: 0009_indexes_for_lists
"""
import sqlalchemy as sa
from alembic import op

revision = "0010_task_project_scope"
down_revision = "0009_indexes_for_lists"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("tasks", sa.Column("project_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_tasks_project_id_projects",
        "tasks",
        "projects",
        ["project_id"],
        ["id"],
    )
    op.create_index("ix_tasks_project_id", "tasks", ["project_id"])


def downgrade():
    op.drop_index("ix_tasks_project_id", table_name="tasks")
    op.drop_constraint("fk_tasks_project_id_projects", "tasks", type_="foreignkey")
    op.drop_column("tasks", "project_id")
