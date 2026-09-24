import uuid

from sqlalchemy.orm import joinedload

from app.domain.user import AuditLog
from app.repositories.base import BaseRepository


class AuditLogRepository(BaseRepository):
    def record(self, *, user_id: uuid.UUID | None, action: str,
               detail: str | None = None, ip_address: str | None = None) -> None:
        self.db.add(AuditLog(user_id=user_id, action=action, detail=detail, ip_address=ip_address))
        self.db.commit()

    def list_recent(self, limit: int = 100) -> list[AuditLog]:
        return (
            self.db.query(AuditLog)
            .options(joinedload(AuditLog.user))
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
            .all()
        )
