"""add issue comments and history timeline

Revision ID: 0017_issue_collaboration
Revises: 0016_issues
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision = "0017_issue_collaboration"
down_revision = "0016_issues"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "issue_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("issue_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("issues.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_issue_comments_issue_id", "issue_comments", ["issue_id"])
    op.create_index("ix_issue_comments_author_id", "issue_comments", ["author_id"])
    op.create_index("ix_issue_comments_created_at", "issue_comments", ["created_at"])

    op.create_table(
        "issue_history_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("issue_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("issues.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("detail", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_issue_history_events_issue_id", "issue_history_events", ["issue_id"])
    op.create_index("ix_issue_history_events_actor_id", "issue_history_events", ["actor_id"])
    op.create_index("ix_issue_history_events_created_at", "issue_history_events", ["created_at"])

    # Existing issues start with a baseline event; earlier edits cannot be reconstructed.
    op.execute(
        "INSERT INTO issue_history_events (id, issue_id, actor_id, event_type, detail, created_at) "
        "SELECT gen_random_uuid(), id, reporter_id, 'issue_created', 'Issue reported (history began with collaboration phase)', created_at FROM issues"
    )


def downgrade():
    op.drop_index("ix_issue_history_events_created_at", table_name="issue_history_events")
    op.drop_index("ix_issue_history_events_actor_id", table_name="issue_history_events")
    op.drop_index("ix_issue_history_events_issue_id", table_name="issue_history_events")
    op.drop_table("issue_history_events")
    op.drop_index("ix_issue_comments_created_at", table_name="issue_comments")
    op.drop_index("ix_issue_comments_author_id", table_name="issue_comments")
    op.drop_index("ix_issue_comments_issue_id", table_name="issue_comments")
    op.drop_table("issue_comments")
