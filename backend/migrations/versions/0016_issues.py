"""add manual issue management core

Revision ID: 0016_issues
Revises: 0015_proj_contrib
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "0016_issues"
down_revision = "0015_proj_contrib"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "issues",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("type", sa.String(40), nullable=False, server_default="issue"),
        sa.Column("category", sa.String(60), nullable=False, server_default="general"),
        sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("severity", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("reporter_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("assignee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("source", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("resolution", sa.Text(), nullable=True),
        sa.Column("resolved_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    for name, column in (("project", "project_id"), ("task", "task_id"), ("reporter", "reporter_id"), ("assignee", "assignee_id"), ("status", "status"), ("created", "created_at")):
        op.create_index(f"ix_issues_{name}_{column}", "issues", [column])


def downgrade():
    for name, column in (("created", "created_at"), ("status", "status"), ("assignee", "assignee_id"), ("reporter", "reporter_id"), ("task", "task_id"), ("project", "project_id")):
        op.drop_index(f"ix_issues_{name}_{column}", table_name="issues")
    op.drop_table("issues")
