import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_audit_repository, get_blocker_service, get_current_user, get_project_service, require_any_permission, require_permission
from app.api.schemas.blockers import BlockerAssigneeUpdateRequest, BlockerCreateRequest, BlockerOut, BlockerStatusUpdateRequest
from app.domain.project import Blocker
from app.domain.user import User
from app.repositories.audit_repository import AuditLogRepository
from app.services.blocker_service import BlockerService, BlockerServiceError
from app.services.project_service import ProjectError, ProjectService

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
        assignee_id=blocker.assignee_id,
        assignee_email=blocker.assignee.email if blocker.assignee else None,
        created_at=blocker.created_at,
        resolved_at=blocker.resolved_at,
    )


@router.get("", response_model=list[BlockerOut])
def list_blockers(
    service: BlockerService = Depends(get_blocker_service),
    project_service: ProjectService = Depends(get_project_service),
    user: User = Depends(require_any_permission("projects:view", "projects:view_assigned")),
):
    visible = []
    for blocker in service.list_blockers():
        try:
            project_service.get_visible_project(blocker.project_id, user)
            visible.append(_to_out(blocker))
        except ProjectError:
            continue
    return visible


@router.post("", response_model=BlockerOut, status_code=status.HTTP_201_CREATED)
def create_blocker(
    payload: BlockerCreateRequest,
    current_user: User = Depends(get_current_user),
    service: BlockerService = Depends(get_blocker_service),
    project_service: ProjectService = Depends(get_project_service),
    _: User = Depends(require_any_permission("blockers:raise", "blockers:manage")),
    audit: AuditLogRepository = Depends(get_audit_repository),
):
    try:
        project_service.get_visible_project(payload.project_id, current_user)
        if payload.assignee_id and "tasks:assign" not in {p.code for p in current_user.role.permissions}:
            raise HTTPException(status_code=403, detail="You do not have permission to assign blockers")
        if payload.assignee_id and not project_service.is_project_member(payload.project_id, payload.assignee_id):
            raise HTTPException(status_code=400, detail="Assignee must belong to the selected project")
        blocker = service.create_blocker(
            project_id=payload.project_id, title=payload.title,
            description=payload.description, raised_by_id=current_user.id, assignee_id=payload.assignee_id,
        )
        audit.record(user_id=current_user.id, action="blocker_created", detail=f"Raised blocker: {blocker.title}")
        return _to_out(blocker)
    except ProjectError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)
    except BlockerServiceError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)


@router.patch("/{blocker_id}/assignee", response_model=BlockerOut)
def update_blocker_assignee(
    blocker_id: uuid.UUID,
    payload: BlockerAssigneeUpdateRequest,
    service: BlockerService = Depends(get_blocker_service),
    project_service: ProjectService = Depends(get_project_service),
    current_user: User = Depends(require_permission("tasks:assign", revalidate_from_db=True)),
    audit: AuditLogRepository = Depends(get_audit_repository),
):
    blocker = service.blockers.get_by_id(blocker_id)
    if blocker is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Blocker not found")
    try:
        project_service.get_visible_project(blocker.project_id, current_user)
    except ProjectError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)
    if payload.assignee_id and not project_service.is_project_member(blocker.project_id, payload.assignee_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assignee must belong to the blocker project")
    blocker = service.update_assignee(blocker_id, payload.assignee_id)
    audit.record(user_id=current_user.id, action="blocker_assigned", detail=f"{blocker.title}: {payload.assignee_id or 'unassigned'}")
    return _to_out(blocker)


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
