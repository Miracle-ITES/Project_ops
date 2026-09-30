"""add contributor assignment timelines

Revision ID: 0015_proj_contrib
Revises: 0014_team_membership_timeline
"""
import sqlalchemy as sa
from alembic import op


revision = "0015_proj_contrib"
down_revision = "0014_team_membership_timeline"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint("uq_project_user", "project_contributors", type_="unique")
    op.add_column("project_contributors", sa.Column("end_date", sa.Date(), nullable=True))
    op.add_column("project_contributors", sa.Column("removed_at", sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column("project_contributors", "removed_at")
    op.drop_column("project_contributors", "end_date")
    op.create_unique_constraint("uq_project_user", "project_contributors", ["project_id", "user_id"])
