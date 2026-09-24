import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import get_audit_repository, require_permission
from app.domain.user import User
from app.repositories.audit_repository import AuditLogRepository

router = APIRouter(prefix="/activity", tags=["activity"])


class ActivityOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None
    user_email: str | None
    action: str
    detail: str | None
    ip_address: str | None
    created_at: datetime


@router.get("", response_model=list[ActivityOut])
def list_activity(
    audit: AuditLogRepository = Depends(get_audit_repository),
    _: User = Depends(require_permission("audit:view")),
):
    return [
        ActivityOut(
            id=entry.id,
            user_id=entry.user_id,
            user_email=entry.user.email if entry.user else None,
            action=entry.action,
            detail=entry.detail,
            ip_address=entry.ip_address,
            created_at=entry.created_at,
        )
        for entry in audit.list_recent()
    ]
