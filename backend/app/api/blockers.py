import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_audit_repository, get_blocker_service, get_current_user, require_permission
from app.api.schemas.blockers import BlockerCreateRequest, BlockerOut, BlockerStatusUpdateRequest
from app.domain.project import Blocker
from app.domain.user import User
from app.repositories.audit_repository import AuditLogRepository
from app.services.blocker_service import BlockerService, BlockerServiceError

router = APIRouter(prefix="/blockers", tags=["blockers"])


def _to_out(blocker: Blocker) -> BlockerOut:
    return BlockerOut(
        id=blocker.id,
        project_id=blocker.project_id,
        project_name=blocker.project.name,
        title=blocker.title,
        description=blocker.description,
        status=blocker.status,
        raised_by_id=blocker.raised_by_id,
        raised_by_email=blocker.raised_by.email,
        created_at=blocker.created_at,
        resolved_at=blocker.resolved_at,
    )


@router.get("", response_model=list[BlockerOut])
def list_blockers(
    service: BlockerService = Depends(get_blocker_service),
    _: User = Depends(require_permission("projects:view")),
):
    return [_to_out(blocker) for blocker in service.list_blockers()]


@router.post("", response_model=BlockerOut, status_code=status.HTTP_201_CREATED)
def create_blocker(
    payload: BlockerCreateRequest,
    current_user: User = Depends(get_current_user),
    service: BlockerService = Depends(get_blocker_service),
    _: User = Depends(require_permission("blockers:raise")),
    audit: AuditLogRepository = Depends(get_audit_repository),
):
    try:
        blocker = service.create_blocker(
            project_id=payload.project_id, title=payload.title,
            description=payload.description, raised_by_id=current_user.id,
        )
        audit.record(user_id=current_user.id, action="blocker_created", detail=f"Raised blocker: {blocker.title}")
        return _to_out(blocker)
    except BlockerServiceError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)


@router.patch("/{blocker_id}/status", response_model=BlockerOut)
def update_blocker_status(
    blocker_id: uuid.UUID,
    payload: BlockerStatusUpdateRequest,
    service: BlockerService = Depends(get_blocker_service),
    current_user: User = Depends(require_permission("blockers:manage")),
    audit: AuditLogRepository = Depends(get_audit_repository),
):
    try:
        blocker = service.update_status(blocker_id, payload.status)
        audit.record(user_id=current_user.id, action="blocker_status_changed", detail=f"{blocker.title}: {payload.status.value}")
        return _to_out(blocker)
    except BlockerServiceError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)
