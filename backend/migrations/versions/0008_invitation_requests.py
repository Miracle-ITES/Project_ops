"""add admin-approved invitation requests

Revision ID: 0008_invitation_requests
Revises: 0007_work_management
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0008_invitation_requests"
down_revision = "0007_work_management"
branch_labels = None
depends_on = None


def upgrade():
    request_status = postgresql.ENUM("pending", "approved", "rejected", name="invitation_request_status")
    request_status.create(op.get_bind(), checkfirst=True)
    request_status_column = postgresql.ENUM("pending", "approved", "rejected", name="invitation_request_status", create_type=False)
    op.create_table(
        "invitation_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("role_name", sa.String(50), nullable=False),
        sa.Column("status", request_status_column, nullable=False, server_default="pending"),
        sa.Column("requested_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("reviewed_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("review_note", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_invitation_requests_email", "invitation_requests", ["email"])
    op.create_index("ix_invitation_requests_status", "invitation_requests", ["status"])


def downgrade():
    op.drop_table("invitation_requests")
    sa.Enum(name="invitation_request_status").drop(op.get_bind(), checkfirst=True)
