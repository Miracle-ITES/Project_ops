"""align task backlog status with persisted values

Revision ID: 0012_task_backlog_status
Revises: 0011_blocker_assignment
"""
from alembic import op


revision = "0012_task_backlog_status"
down_revision = "0011_blocker_assignment"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = 'task_status' AND e.enumlabel = 'to_do'
            ) AND NOT EXISTS (
                SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = 'task_status' AND e.enumlabel = 'backlog'
            ) THEN
                ALTER TYPE task_status RENAME VALUE 'to_do' TO 'backlog';
            END IF;
        END $$;
    """)


def downgrade():
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = 'task_status' AND e.enumlabel = 'backlog'
            ) AND NOT EXISTS (
                SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = 'task_status' AND e.enumlabel = 'to_do'
            ) THEN
                ALTER TYPE task_status RENAME VALUE 'backlog' TO 'to_do';
            END IF;
        END $$;
    """)
