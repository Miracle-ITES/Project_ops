import math
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_blocker_service, get_project_service, get_work_db, require_permission
from app.api.schemas.issues import (
    IssueCommentCreate, IssueCommentOut, IssueCreate, IssueHistoryOut, IssueOut,
    IssuePage, IssueUpdate, TaskIssueCreate,
)
from app.domain.issue import Issue, IssueComment, IssueHistoryEvent, IssueSource, IssueStatus
from app.domain.user import AuditLog, User
from app.domain.work import Task
from app.services.blocker_service import BlockerService, BlockerServiceError
from app.services.project_service import ProjectError, ProjectService

router = APIRouter(tags=["issues"])


def _issue_query(db: Session, user: User):
    permissions = {permission.code for permission in user.role.permissions}
    query = db.query(Issue).options(
        joinedload(Issue.project), joinedload(Issue.task),
        joinedload(Issue.reporter), joinedload(Issue.assignee),
    )
    if "users:manage" in permissions or ("projects:view" in permissions and "projects:create" not in permissions):
        return query
    if "projects:create" in permissions:
        return query.filter(or_(Issue.reporter_id == user.id, Issue.project.has(owner_id=user.id)))
    return query.filter(Issue.reporter_id == user.id)


def _find_issue(db: Session, issue_id: uuid.UUID, user: User) -> Issue | None:
    return _issue_query(db, user).filter(Issue.id == issue_id).first()


def _require_collaboration_access(issue: Issue, user: User, project_service: ProjectService) -> None:
    permissions = {permission.code for permission in user.role.permissions}
    if "users:manage" in permissions or issue.reporter_id == user.id:
        return
    if project_service.is_project_member(issue.project_id, user.id):
        return
    raise HTTPException(status_code=403, detail="Issue discussion and history are available to issue reporters and project members")


def _to_out(issue: Issue) -> IssueOut:
    return IssueOut(
        id=issue.id, project_id=issue.project_id, project_name=issue.project.name,
        task_id=issue.task_id, task_title=issue.task.title if issue.task else None,
        title=issue.title, description=issue.description, type=issue.type, category=issue.category,
        priority=issue.priority, severity=issue.severity, status=issue.status,
        reporter_id=issue.reporter_id, reporter_name=issue.reporter.full_name or issue.reporter.email,
        assignee_id=issue.assignee_id,
        assignee_name=(issue.assignee.full_name or issue.assignee.email) if issue.assignee else None,
        source=issue.source, due_date=issue.due_date, resolution=issue.resolution,
        resolved_by_id=issue.resolved_by_id, resolved_at=issue.resolved_at,
        escalated_to_blocker_id=issue.escalated_to_blocker_id,
        created_at=issue.created_at, updated_at=issue.updated_at,
    )


def _create_issue(db: Session, *, payload: IssueCreate, user: User, project_service: ProjectService,
                  source: IssueSource, task_id: uuid.UUID | None = None) -> Issue:
    try:
        project = project_service.get_visible_project(payload.project_id, user)
    except ProjectError:
        raise HTTPException(status_code=404, detail="Project not found")
    linked_task_id = task_id or payload.task_id
    if linked_task_id:
        linked_task = db.query(Task).filter(Task.id == linked_task_id).first()
        if linked_task is None or linked_task.project_id != project.id:
            raise HTTPException(status_code=400, detail="Task must belong to the selected project")
    permissions = {permission.code for permission in user.role.permissions}
    if payload.assignee_id:
        if "tasks:assign" not in permissions:
            raise HTTPException(status_code=403, detail="You do not have permission to assign issues")
        if not project_service.is_project_member(payload.project_id, payload.assignee_id):
            raise HTTPException(status_code=400, detail="Assignee must belong to the selected project")
    issue = Issue(
        project_id=payload.project_id, task_id=linked_task_id, title=payload.title.strip(),
        description=payload.description, type=payload.type.strip(), category=payload.category.strip(),
        priority=payload.priority, severity=payload.severity, status=IssueStatus.OPEN,
        reporter_id=user.id, assignee_id=payload.assignee_id, source=source,
        due_date=payload.due_date,
    )
    db.add(issue)
    db.flush()
    db.add(AuditLog(
        user_id=user.id,
        action="issue_created",
        detail=f"{issue.title} in {project.name} (reported from {source.value})",
    ))
    db.add(IssueHistoryEvent(
        issue_id=issue.id, actor_id=user.id, event_type="issue_created",
        detail=f"Issue reported from {source.value}",
    ))
    db.commit()
    return db.query(Issue).options(joinedload(Issue.project), joinedload(Issue.task), joinedload(Issue.reporter), joinedload(Issue.assignee)).filter(Issue.id == issue.id).one()


@router.get("/issues", response_model=IssuePage)
def list_issues(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    issue_status: IssueStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_work_db),
    user: User = Depends(require_permission("issues:view")),
):
    query = _issue_query(db, user)
    if issue_status:
        query = query.filter(Issue.status == issue_status.value)
    total = query.count()
    items = query.order_by(Issue.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return IssuePage(items=[_to_out(issue) for issue in items], page=page, page_size=page_size, total=total, pages=math.ceil(total / page_size) if total else 0)


@router.post("/issues", response_model=IssueOut, status_code=status.HTTP_201_CREATED)
def create_issue(
    payload: IssueCreate, db: Session = Depends(get_work_db),
    user: User = Depends(require_permission("issues:raise", revalidate_from_db=True)),
    project_service: ProjectService = Depends(get_project_service),
):
    return _to_out(_create_issue(db, payload=payload, user=user, project_service=project_service, source=IssueSource.MANUAL))


@router.post("/tasks/{task_id}/report-issue", response_model=IssueOut, status_code=status.HTTP_201_CREATED)
def report_task_issue(
    task_id: uuid.UUID, payload: TaskIssueCreate, db: Session = Depends(get_work_db),
    user: User = Depends(require_permission("issues:raise", revalidate_from_db=True)),
    project_service: ProjectService = Depends(get_project_service),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if task is None or task.project_id is None:
        raise HTTPException(status_code=404, detail="Task not found")
    try:
        project_service.get_visible_project(task.project_id, user)
    except ProjectError:
        raise HTTPException(status_code=404, detail="Task not found")
    issue_payload = IssueCreate(project_id=task.project_id, **payload.model_dump())
    return _to_out(_create_issue(db, payload=issue_payload, user=user, project_service=project_service, source=IssueSource.TASK, task_id=task.id))


@router.get("/issues/{issue_id}", response_model=IssueOut)
def get_issue(issue_id: uuid.UUID, db: Session = Depends(get_work_db), user: User = Depends(require_permission("issues:view"))):
    issue = _find_issue(db, issue_id, user)
    if issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")
    return _to_out(issue)


@router.patch("/issues/{issue_id}", response_model=IssueOut)
def update_issue(
    issue_id: uuid.UUID, payload: IssueUpdate, db: Session = Depends(get_work_db),
    user: User = Depends(require_permission("issues:manage", revalidate_from_db=True)),
    project_service: ProjectService = Depends(get_project_service),
):
    issue = _find_issue(db, issue_id, user)
    if issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")
    try:
        project_service.get_visible_project(issue.project_id, user)
    except ProjectError:
        raise HTTPException(status_code=404, detail="Issue not found")
    changes = payload.model_dump(exclude_unset=True)
    if changes.get("status") == IssueStatus.ESCALATED:
        raise HTTPException(status_code=400, detail="Use the escalation action to create a linked ticket")
    if "assignee_id" in changes and changes["assignee_id"] and not project_service.is_project_member(issue.project_id, changes["assignee_id"]):
        raise HTTPException(status_code=400, detail="Assignee must belong to the issue project")
    for field, value in changes.items():
        if field in {"status", "priority", "severity"} and value is not None:
            value = value.value
        setattr(issue, field, value)
    if changes.get("status") == IssueStatus.RESOLVED:
        issue.resolved_at = datetime.utcnow()
        issue.resolved_by_id = user.id
    elif changes.get("status") in {IssueStatus.OPEN, IssueStatus.IN_PROGRESS}:
        issue.resolved_at = None
        issue.resolved_by_id = None
    changed_fields = ", ".join(changes)
    db.add(AuditLog(
        user_id=user.id,
        action="issue_updated",
        detail=f"{issue.title} in {issue.project.name}: updated {changed_fields}",
    ))
    db.add(IssueHistoryEvent(
        issue_id=issue.id, actor_id=user.id, event_type="issue_updated",
        detail=f"Updated {changed_fields}",
    ))
    db.commit()
    issue = db.query(Issue).options(joinedload(Issue.project), joinedload(Issue.task), joinedload(Issue.reporter), joinedload(Issue.assignee)).filter(Issue.id == issue.id).one()
    return _to_out(issue)


@router.post("/issues/{issue_id}/escalate", response_model=IssueOut)
def escalate_issue(
    issue_id: uuid.UUID, db: Session = Depends(get_work_db),
    user: User = Depends(require_permission("blockers:manage", revalidate_from_db=True)),
    project_service: ProjectService = Depends(get_project_service),
    blocker_service: BlockerService = Depends(get_blocker_service),
):
    issue = db.query(Issue).filter(Issue.id == issue_id).with_for_update().first()
    if issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")
    try:
        project_service.get_visible_project(issue.project_id, user)
    except ProjectError:
        raise HTTPException(status_code=404, detail="Issue not found")
    if issue.escalated_to_blocker_id:
        raise HTTPException(status_code=409, detail="This issue has already been escalated")
    if issue.status in {IssueStatus.RESOLVED, IssueStatus.CLOSED}:
        raise HTTPException(status_code=400, detail="Resolved or closed issues cannot be escalated")
    if issue.assignee_id and not project_service.is_project_member(issue.project_id, issue.assignee_id):
        raise HTTPException(status_code=400, detail="Remove or replace the issue assignee before escalation")

    try:
        blocker = blocker_service.create_blocker(
            project_id=issue.project_id,
            title=issue.title,
            description=issue.description,
            raised_by_id=user.id,
            assignee_id=issue.assignee_id,
            task_id=issue.task_id,
            commit=False,
        )
    except BlockerServiceError as exc:
        raise HTTPException(status_code=404, detail=exc.message)

    issue.escalated_to_blocker_id = blocker.id
    issue.status = IssueStatus.ESCALATED
    detail = f"{issue.title} in {issue.project.name} escalated to ticket {blocker.id}"
    db.add(IssueHistoryEvent(
        issue_id=issue.id, actor_id=user.id, event_type="issue_escalated",
        detail=f"Escalated to ticket {blocker.id}",
    ))
    db.add(AuditLog(user_id=user.id, action="issue_escalated", detail=detail))
    db.add(AuditLog(user_id=user.id, action="blocker_created", detail=f"Created from issue: {detail}"))
    db.commit()
    issue = db.query(Issue).options(
        joinedload(Issue.project), joinedload(Issue.task), joinedload(Issue.reporter), joinedload(Issue.assignee),
    ).filter(Issue.id == issue.id).one()
    return _to_out(issue)


@router.get("/issues/{issue_id}/comments", response_model=list[IssueCommentOut])
def list_issue_comments(
    issue_id: uuid.UUID, db: Session = Depends(get_work_db),
    user: User = Depends(require_permission("issues:view")),
    project_service: ProjectService = Depends(get_project_service),
):
    issue = _find_issue(db, issue_id, user)
    if issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")
    _require_collaboration_access(issue, user, project_service)
    comments = db.query(IssueComment).options(joinedload(IssueComment.author)).filter(
        IssueComment.issue_id == issue_id
    ).order_by(IssueComment.created_at.asc()).all()
    return [IssueCommentOut(
        id=comment.id, issue_id=comment.issue_id, author_id=comment.author_id,
        author_name=(comment.author.full_name or comment.author.email) if comment.author else "Former user",
        body=comment.body, created_at=comment.created_at,
    ) for comment in comments]


@router.post("/issues/{issue_id}/comments", response_model=IssueCommentOut, status_code=status.HTTP_201_CREATED)
def add_issue_comment(
    issue_id: uuid.UUID, payload: IssueCommentCreate, db: Session = Depends(get_work_db),
    user: User = Depends(require_permission("issues:view")),
    project_service: ProjectService = Depends(get_project_service),
):
    issue = _find_issue(db, issue_id, user)
    if issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")
    _require_collaboration_access(issue, user, project_service)
    comment = IssueComment(issue_id=issue.id, author_id=user.id, body=payload.body)
    db.add(comment)
    db.flush()
    db.add(IssueHistoryEvent(
        issue_id=issue.id, actor_id=user.id, event_type="comment_added", detail="Added a comment",
    ))
    db.add(AuditLog(
        user_id=user.id, action="issue_comment_added",
        detail=f"Commented on {issue.title} in {issue.project.name}",
    ))
    db.commit()
    comment = db.query(IssueComment).options(joinedload(IssueComment.author)).filter(IssueComment.id == comment.id).one()
    return IssueCommentOut(
        id=comment.id, issue_id=comment.issue_id, author_id=comment.author_id,
        author_name=comment.author.full_name or comment.author.email if comment.author else "Former user",
        body=comment.body, created_at=comment.created_at,
    )


@router.get("/issues/{issue_id}/history", response_model=list[IssueHistoryOut])
def get_issue_history(
    issue_id: uuid.UUID, db: Session = Depends(get_work_db),
    user: User = Depends(require_permission("issues:view")),
    project_service: ProjectService = Depends(get_project_service),
):
    issue = _find_issue(db, issue_id, user)
    if issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")
    _require_collaboration_access(issue, user, project_service)
    events = db.query(IssueHistoryEvent).options(joinedload(IssueHistoryEvent.actor)).filter(
        IssueHistoryEvent.issue_id == issue_id
    ).order_by(IssueHistoryEvent.created_at.desc()).all()
    return [IssueHistoryOut(
        id=event.id, issue_id=event.issue_id, actor_id=event.actor_id,
        actor_name=(event.actor.full_name or event.actor.email) if event.actor else "Former user",
        event_type=event.event_type, detail=event.detail, created_at=event.created_at,
    ) for event in events]

