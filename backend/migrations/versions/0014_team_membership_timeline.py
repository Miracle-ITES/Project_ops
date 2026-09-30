"""retain team membership history and end dates

Revision ID: 0014_team_membership_timeline
Revises: 0013_blocker_created_at_index
"""
import sqlalchemy as sa
from alembic import op


revision = "0014_team_membership_timeline"
down_revision = "0013_blocker_created_at_index"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint("uq_team_user", "team_memberships", type_="unique")
    op.add_column("team_memberships", sa.Column("end_date", sa.Date(), nullable=True))
    op.add_column("team_memberships", sa.Column("left_at", sa.DateTime(), nullable=True))
    op.create_index("ix_team_memberships_team_joined", "team_memberships", ["team_id", "joined_at"])


def downgrade():
    op.drop_index("ix_team_memberships_team_joined", table_name="team_memberships")
    op.drop_column("team_memberships", "left_at")
    op.drop_column("team_memberships", "end_date")
    op.create_unique_constraint("uq_team_user", "team_memberships", ["team_id", "user_id"])
