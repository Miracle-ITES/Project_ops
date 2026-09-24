"""add company profile fields to users

Revision ID: 0006_user_company_profile
Revises: 0005_invitations_blockers
Create Date: 2026-09-24
"""
import sqlalchemy as sa
from alembic import op

revision = "0006_user_company_profile"
down_revision = "0005_invitations_blockers"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("company_name", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("job_title", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("department", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("phone_number", sa.String(50), nullable=True))
    op.add_column("users", sa.Column("location", sa.String(255), nullable=True))


def downgrade():
    op.drop_column("users", "location")
    op.drop_column("users", "phone_number")
    op.drop_column("users", "department")
    op.drop_column("users", "job_title")
    op.drop_column("users", "company_name")
