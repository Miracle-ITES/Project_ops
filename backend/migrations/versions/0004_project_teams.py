"""add teams to projects

Revision ID: 0004_project_teams
Revises: 0003_teams_projects
Create Date: 2026-09-23
"""
import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004_project_teams"
down_revision = "0003_teams_projects"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "project_teams",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "team_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("teams.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("added_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("project_id", "team_id", name="uq_project_team"),
    )


def downgrade():
    op.drop_table("project_teams")
