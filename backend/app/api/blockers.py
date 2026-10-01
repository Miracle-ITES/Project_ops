import uuid
import math

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_audit_repository, get_blocker_service, get_current_user, get_project_service, require_any_permission, require_permission
from app.api.schemas.blockers import BlockerAssigneeUpdateRequest, BlockerCreateRequest, BlockerOut, BlockerPage, BlockerStatusUpdateRequest
from app.domain.project import Blocker
from app.domain.user import User
from app.domain.work import Task
from app.repositories.audit_repository import AuditLogRepository
from app.services.blocker_service import BlockerService, BlockerServiceError
from app.services.project_service import ProjectError, ProjectService

router = APIRouter(prefix="/blockers", tags=["blockers"])


def _to_out(blocker: Blocker) -> BlockerOut:
    return BlockerOut(
        id=blocker.id,
        project_id=blocker.project_id,
        task_id=blocker.task_id,
        task_title=blocker.task.title if blocker.task else None,
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


@router.get("", response_model=BlockerPage)
def list_blockers(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    service: BlockerService = Depends(get_blocker_service),
    user: User = Depends(require_any_permission("projects:view", "projects:view_assigned")),
):
    items, total = service.list_blockers(user, offset=(page - 1) * page_size, limit=page_size)
    return BlockerPage(
        items=[_to_out(blocker) for blocker in items],
        page=page,
        page_size=page_size,
        total=total,
        pages=math.ceil(total / page_size) if total else 0,
    )


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
        if payload.assignee_id and not project_service.is_project_member(payload.project_id, payload.assignee_id):
            raise HTTPException(status_code=400, detail="Assignee must belong to the selected project")
        if payload.task_id:
            task = service.blockers.db.query(Task).filter(Task.id == payload.task_id).first()
            if task is None or task.project_id != payload.project_id:
                raise HTTPException(status_code=400, detail="Task must belong to the selected project")
        blocker = service.create_blocker(
            project_id=payload.project_id, title=payload.title,
            description=payload.description, raised_by_id=current_user.id, assignee_id=payload.assignee_id,
            task_id=payload.task_id,
        )
        audit.record(user_id=current_user.id, action="blocker_created", detail=f"Raised ticket: {blocker.title}")
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    try:
        project_service.get_visible_project(blocker.project_id, current_user)
    except ProjectError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)
    if payload.assignee_id and not project_service.is_project_member(blocker.project_id, payload.assignee_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Assignee must belong to the ticket project")
    blocker = service.update_assignee(blocker_id, payload.assignee_id)
    audit.record(user_id=current_user.id, action="blocker_assigned", detail=f"{blocker.title}: {payload.assignee_id or 'unassigned'}")
    return _to_out(blocker)


@router.patch("/{blocker_id}/status", response_model=BlockerOut)
def update_blocker_status(
    blocker_id: uuid.UUID,
    payload: BlockerStatusUpdateRequest,
    service: BlockerService = Depends(get_blocker_service),
    project_service: ProjectService = Depends(get_project_service),
    current_user: User = Depends(require_permission("blockers:manage", revalidate_from_db=True)),
    audit: AuditLogRepository = Depends(get_audit_repository),
):
    try:
        blocker = service.blockers.get_by_id(blocker_id)
        if blocker is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
        project_service.get_visible_project(blocker.project_id, current_user)
        blocker = service.update_status(blocker_id, payload.status)
        audit.record(user_id=current_user.id, action="blocker_status_changed", detail=f"{blocker.title}: {payload.status.value}")
        return _to_out(blocker)
    except ProjectError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found") from exc
    except BlockerServiceError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)
