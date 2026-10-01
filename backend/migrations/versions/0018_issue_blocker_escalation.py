"""link escalated issues to blockers

Revision ID: 0018_issue_blocker_escalation
Revises: 0017_issue_collaboration
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "0018_issue_blocker_escalation"
down_revision = "0017_issue_collaboration"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "issues",
        sa.Column("escalated_to_blocker_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_issues_escalated_to_blocker_id_blockers",
        "issues", "blockers", ["escalated_to_blocker_id"], ["id"], ondelete="SET NULL",
    )
    op.create_unique_constraint(
        "uq_issues_escalated_to_blocker_id", "issues", ["escalated_to_blocker_id"],
    )


def downgrade():
    op.drop_constraint("uq_issues_escalated_to_blocker_id", "issues", type_="unique")
    op.drop_constraint("fk_issues_escalated_to_blocker_id_blockers", "issues", type_="foreignkey")
    op.drop_column("issues", "escalated_to_blocker_id")
