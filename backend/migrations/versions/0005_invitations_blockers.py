"""add invitations, profile completion, and blockers

Revision ID: 0005_invitations_blockers
Revises: 0004_project_teams
Create Date: 2026-09-24
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0005_invitations_blockers"
down_revision = "0004_project_teams"
branch_labels = None
depends_on = None

blocker_status = postgresql.ENUM("open", "resolved", name="blocker_status")


def upgrade():
    op.add_column("users", sa.Column("profile_completed", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("users", sa.Column("invitation_sent_at", sa.DateTime(), nullable=True))

    op.create_table(
        "blockers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", blocker_status, nullable=False, server_default="open"),
        sa.Column("raised_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
    )


def downgrade():
    op.drop_table("blockers")
    blocker_status.drop(op.get_bind(), checkfirst=True)
    op.drop_column("users", "invitation_sent_at")
    op.drop_column("users", "profile_completed")
