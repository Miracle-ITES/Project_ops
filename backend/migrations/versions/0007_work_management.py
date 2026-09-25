"""add tasks daily updates and learning items

Revision ID: 0007_work_management
Revises: 0006_user_company_profile
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0007_work_management"
down_revision = "0006_user_company_profile"
branch_labels = None
depends_on = None


def upgrade():
    task_status = sa.Enum("backlog", "in_progress", "completed", name="task_status")
    task_priority = sa.Enum("low", "medium", "high", "critical", name="task_priority")
    learning_status = sa.Enum("planned", "in_progress", "completed", name="learning_status")
    task_status.create(op.get_bind(), checkfirst=True)
    task_priority.create(op.get_bind(), checkfirst=True)
    learning_status.create(op.get_bind(), checkfirst=True)
    # The enum types are created explicitly above; table creation must only
    # reference them, otherwise SQLAlchemy attempts CREATE TYPE a second time.
    task_status_column = postgresql.ENUM("backlog", "in_progress", "completed", name="task_status", create_type=False)
    task_priority_column = postgresql.ENUM("low", "medium", "high", "critical", name="task_priority", create_type=False)
    learning_status_column = postgresql.ENUM("planned", "in_progress", "completed", name="learning_status", create_type=False)
    op.create_table("tasks", sa.Column("id", sa.UUID(), nullable=False), sa.Column("title", sa.String(200), nullable=False), sa.Column("description", sa.Text()), sa.Column("status", task_status_column, nullable=False), sa.Column("priority", task_priority_column, nullable=False), sa.Column("due_date", sa.Date()), sa.Column("assignee_id", sa.UUID(), sa.ForeignKey("users.id")), sa.Column("reviewer_id", sa.UUID(), sa.ForeignKey("users.id")), sa.Column("created_by_id", sa.UUID(), sa.ForeignKey("users.id"), nullable=False), sa.Column("created_at", sa.DateTime(), nullable=False), sa.Column("updated_at", sa.DateTime(), nullable=False), sa.PrimaryKeyConstraint("id"))
    op.create_index("ix_tasks_title", "tasks", ["title"])
    op.create_index("ix_tasks_status", "tasks", ["status"])
    op.create_index("ix_tasks_due_date", "tasks", ["due_date"])
    op.create_index("ix_tasks_assignee_id", "tasks", ["assignee_id"])
    op.create_index("ix_tasks_reviewer_id", "tasks", ["reviewer_id"])
    op.create_table("daily_updates", sa.Column("id", sa.UUID(), nullable=False), sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False), sa.Column("update_date", sa.Date(), nullable=False), sa.Column("summary", sa.Text(), nullable=False), sa.Column("accomplishments", sa.Text()), sa.Column("plans", sa.Text()), sa.Column("blockers", sa.Text()), sa.Column("created_at", sa.DateTime(), nullable=False), sa.Column("updated_at", sa.DateTime(), nullable=False), sa.PrimaryKeyConstraint("id"), sa.UniqueConstraint("user_id", "update_date", name="uq_daily_update_user_date"))
    op.create_index("ix_daily_updates_user_id", "daily_updates", ["user_id"])
    op.create_index("ix_daily_updates_update_date", "daily_updates", ["update_date"])
    op.create_table("learning_items", sa.Column("id", sa.UUID(), nullable=False), sa.Column("topic", sa.String(200), nullable=False), sa.Column("notes", sa.Text()), sa.Column("status", learning_status_column, nullable=False), sa.Column("session_date", sa.Date()), sa.Column("owner_id", sa.UUID(), sa.ForeignKey("users.id"), nullable=False), sa.Column("completed_at", sa.DateTime()), sa.Column("created_at", sa.DateTime(), nullable=False), sa.Column("updated_at", sa.DateTime(), nullable=False), sa.PrimaryKeyConstraint("id"))
    op.create_index("ix_learning_items_topic", "learning_items", ["topic"])
    op.create_index("ix_learning_items_status", "learning_items", ["status"])
    op.create_index("ix_learning_items_owner_id", "learning_items", ["owner_id"])


def downgrade():
    op.drop_table("learning_items")
    op.drop_table("daily_updates")
    op.drop_table("tasks")
    sa.Enum(name="learning_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="task_priority").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="task_status").drop(op.get_bind(), checkfirst=True)
