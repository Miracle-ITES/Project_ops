import csv
import io
import math
import uuid
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.deps import get_project_service, get_work_db, require_any_permission, require_permission
from app.api.schemas.work import (
    DailyUpdateCreate, DailyUpdateOut, DailyUpdatePage, DashboardDeadlineOut, DashboardOut, LearningCreate,
    LearningOut, LearningPage, LearningUpdate, PageMeta, TaskCreate, TaskOut, TaskPage, UserBrief,
    TaskUpdate,
)
from app.domain.project import Blocker, BlockerStatus, Milestone, MilestoneStatus, Project, ProjectContributor, ProjectMaturity, ProjectPriority, ProjectTeam
from app.domain.team import Team, TeamMembership
from app.domain.user import AuditLog, User
from app.domain.work import DailyUpdate, LearningItem, LearningStatus, Task, TaskStatus
from app.services.project_service import ProjectError, ProjectService

router = APIRouter(tags=["work management"])


def _meta(page: int, page_size: int, total: int) -> PageMeta:
    return PageMeta(page=page, page_size=page_size, total=total, pages=math.ceil(total / page_size) if total else 0)


def _task_visibility(db: Session, user: User):
    permissions = {permission.code for permission in user.role.permissions}
    if "users:manage" in permissions or ("projects:view" in permissions and "projects:create" not in permissions):
        return None, False

    project_ids = db.query(Project.id)
    if "projects:create" in permissions:
        project_ids = project_ids.filter(Project.owner_id == user.id)
    elif "projects:view_assigned" in permissions:
        team_ids = db.query(TeamMembership.team_id).filter(
            TeamMembership.user_id == user.id,
            TeamMembership.left_at.is_(None),
            or_(TeamMembership.end_date.is_(None), TeamMembership.end_date >= date.today()),
        )
        contributor_projects = db.query(ProjectContributor.project_id).filter(
            ProjectContributor.user_id == user.id,
            ProjectContributor.removed_at.is_(None),
            or_(ProjectContributor.end_date.is_(None), ProjectContributor.end_date >= date.today()),
        )
        team_projects = db.query(ProjectTeam.project_id).filter(ProjectTeam.team_id.in_(team_ids))
        project_ids = project_ids.filter(or_(
            Project.owner_id == user.id,
            Project.id.in_(contributor_projects),
            Project.id.in_(team_projects),
        ))
    else:
        project_ids = project_ids.filter(False)
    return project_ids, "projects:view_assigned" in permissions and "projects:create" not in permissions


def _task_query(db: Session, search: str | None, task_status: TaskStatus | None, assignee_id: uuid.UUID | None, user: User | None = None, project_id: uuid.UUID | None = None):
    query = db.query(Task).options(
        selectinload(Task.assignee),
        selectinload(Task.reviewer),
        selectinload(Task.created_by),
    )
    if search:
        query = query.filter(or_(Task.title.ilike(f"%{search}%"), Task.description.ilike(f"%{search}%")))
    if task_status:
        query = query.filter(Task.status == task_status)
    if assignee_id:
        query = query.filter(Task.assignee_id == assignee_id)
    if project_id:
        query = query.filter(Task.project_id == project_id)
    if user is not None:
        project_ids, assigned_only = _task_visibility(db, user)
        if project_ids is not None:
            query = query.filter(Task.project_id.in_(project_ids))
        if assigned_only:
            query = query.filter(Task.assignee_id == user.id)
    return query.order_by(Task.created_at.desc())


@router.get("/tasks/assignees", response_model=list[UserBrief])
def list_task_assignees(
    db: Session = Depends(get_work_db),
    user: User = Depends(require_any_permission("projects:view", "projects:view_assigned")),
):
    query = db.query(User).join(Task, Task.assignee_id == User.id)
    project_ids, assigned_only = _task_visibility(db, user)
    if project_ids is not None:
        query = query.filter(Task.project_id.in_(project_ids))
    if assigned_only:
        query = query.filter(Task.assignee_id == user.id)
    return query.distinct().order_by(User.full_name, User.email).all()


@router.get("/tasks", response_model=TaskPage)
def list_tasks(
    search: str | None = None,
    task_status: TaskStatus | None = Query(default=None, alias="status"),
    assignee_id: uuid.UUID | None = None,
    project_id: uuid.UUID | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_work_db),
    user: User = Depends(require_any_permission("projects:view", "projects:view_assigned")),
):
    query = _task_query(db, search, task_status, assignee_id, user, project_id)
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return TaskPage(items=items, meta=_meta(page, page_size, total))


@router.post("/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, db: Session = Depends(get_work_db), user: User = Depends(require_permission("projects:create", revalidate_from_db=True)), project_service: ProjectService = Depends(get_project_service)):
    permissions = {permission.code for permission in user.role.permissions}
    if (payload.assignee_id or payload.reviewer_id) and "tasks:assign" not in permissions:
        raise HTTPException(status_code=403, detail="You do not have permission to assign tasks")
    try:
        project_service.get_visible_project(payload.project_id, user)
    except ProjectError as exc:
        raise HTTPException(status_code=404, detail=exc.message)
    if payload.assignee_id and not project_service.is_project_member(payload.project_id, payload.assignee_id):
        raise HTTPException(status_code=400, detail="Assignee must belong to the selected project")
    if payload.reviewer_id and not project_service.is_project_member(payload.project_id, payload.reviewer_id):
        raise HTTPException(status_code=400, detail="Reviewer must belong to the selected project")
    task = Task(**payload.model_dump(), created_by_id=user.id)
    db.add(task)
    db.flush()
    db.add(AuditLog(user_id=user.id, action="task_created", detail=task.title))
    db.commit()
    return db.query(Task).options(
        selectinload(Task.assignee),
        selectinload(Task.reviewer),
        selectinload(Task.created_by),
    ).get(task.id)


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: uuid.UUID, payload: TaskUpdate, db: Session = Depends(get_work_db), user: User = Depends(require_any_permission("projects:create", "status:update")), project_service: ProjectService = Depends(get_project_service)):
    task = db.query(Task).get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    changes = payload.model_dump(exclude_unset=True)
    permissions = {permission.code for permission in user.role.permissions}
    if "projects:create" in permissions:
        try:
            project_service.get_visible_project(task.project_id, user)
        except ProjectError:
            raise HTTPException(status_code=404, detail="Task not found")
        target_assignee = changes.get("assignee_id", task.assignee_id)
        if ("assignee_id" in changes or "reviewer_id" in changes) and "tasks:assign" not in permissions:
            raise HTTPException(status_code=403, detail="You do not have permission to assign tasks")
        if target_assignee and not project_service.is_project_member(task.project_id, target_assignee):
            raise HTTPException(status_code=400, detail="Assignee must belong to the selected project")
        target_reviewer = changes.get("reviewer_id", task.reviewer_id)
        if target_reviewer and not project_service.is_project_member(task.project_id, target_reviewer):
            raise HTTPException(status_code=400, detail="Reviewer must belong to the selected project")
    elif task.assignee_id != user.id or set(changes) - {"status"}:
        raise HTTPException(status_code=403, detail="Members can only update status on their assigned tasks")
    elif task.project_id is None or not project_service.is_assigned_to_user(task.project_id, user.id):
        raise HTTPException(status_code=404, detail="Task not found")
    for field, value in changes.items():
        setattr(task, field, value)
    db.add(AuditLog(user_id=user.id, action="task_updated", detail=f"{task.title}: {', '.join(changes)}"))
    db.commit()
    return db.query(Task).options(
        selectinload(Task.assignee),
        selectinload(Task.reviewer),
        selectinload(Task.created_by),
    ).get(task.id)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: uuid.UUID, db: Session = Depends(get_work_db), user: User = Depends(require_permission("projects:create", revalidate_from_db=True)), project_service: ProjectService = Depends(get_project_service)):
    task = db.query(Task).get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    try:
        project_service.get_visible_project(task.project_id, user)
    except ProjectError:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.add(AuditLog(user_id=user.id, action="task_deleted", detail=str(task_id)))
    db.commit()


def _daily_query(db: Session, search: str | None):
    query = db.query(DailyUpdate).options(joinedload(DailyUpdate.user))
    if search:
        query = query.join(DailyUpdate.user).filter(or_(DailyUpdate.summary.ilike(f"%{search}%"), User.full_name.ilike(f"%{search}%"), User.email.ilike(f"%{search}%")))
    return query.order_by(DailyUpdate.update_date.desc(), DailyUpdate.created_at.desc())


@router.get("/daily-updates", response_model=DailyUpdatePage)
def list_daily_updates(search: str | None = None, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), db: Session = Depends(get_work_db), user: User = Depends(require_any_permission("projects:view", "projects:view_assigned", "daily_updates:submit"))):
    query = _daily_query(db, search)
    permissions = {permission.code for permission in user.role.permissions}
    if "projects:view" not in permissions and "users:manage" not in permissions:
        query = query.filter(DailyUpdate.user_id == user.id)
    total = query.count()
    return DailyUpdatePage(items=query.offset((page - 1) * page_size).limit(page_size).all(), meta=_meta(page, page_size, total))


@router.post("/daily-updates", response_model=DailyUpdateOut)
def submit_daily_update(payload: DailyUpdateCreate, db: Session = Depends(get_work_db), user: User = Depends(require_permission("daily_updates:submit"))):
    update = db.query(DailyUpdate).filter_by(user_id=user.id, update_date=payload.update_date).first()
    if update:
        for field, value in payload.model_dump().items():
            setattr(update, field, value)
        action = "daily_update_updated"
    else:
        update = DailyUpdate(**payload.model_dump(), user_id=user.id)
        db.add(update)
        action = "daily_update_submitted"
    db.add(AuditLog(user_id=user.id, action=action, detail=str(payload.update_date)))
    db.commit()
    return db.query(DailyUpdate).options(joinedload(DailyUpdate.user)).get(update.id)


@router.get("/learning", response_model=LearningPage)
def list_learning(search: str | None = None, learning_status: LearningStatus | None = Query(default=None, alias="status"), page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), db: Session = Depends(get_work_db), _: User = Depends(require_any_permission("projects:view", "projects:view_assigned", "learning:submit"))):
    query = db.query(LearningItem).options(joinedload(LearningItem.owner))
    if search:
        query = query.filter(or_(LearningItem.topic.ilike(f"%{search}%"), LearningItem.notes.ilike(f"%{search}%")))
    if learning_status:
        query = query.filter(LearningItem.status == learning_status)
    query = query.order_by(LearningItem.created_at.desc())
    total = query.count()
    return LearningPage(items=query.offset((page - 1) * page_size).limit(page_size).all(), meta=_meta(page, page_size, total))


@router.post("/learning", response_model=LearningOut, status_code=status.HTTP_201_CREATED)
def create_learning(payload: LearningCreate, db: Session = Depends(get_work_db), user: User = Depends(require_permission("projects:create"))):
    item = LearningItem(**payload.model_dump(), owner_id=user.id, completed_at=datetime.utcnow() if payload.status == LearningStatus.COMPLETED else None)
    db.add(item)
    db.add(AuditLog(user_id=user.id, action="learning_created", detail=item.topic))
    db.commit()
    return db.query(LearningItem).options(joinedload(LearningItem.owner)).get(item.id)


@router.patch("/learning/{item_id}", response_model=LearningOut)
def update_learning(item_id: uuid.UUID, payload: LearningUpdate, db: Session = Depends(get_work_db), user: User = Depends(require_permission("projects:create"))):
    item = db.query(LearningItem).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Learning item not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    if item.status == LearningStatus.COMPLETED and item.completed_at is None:
        item.completed_at = datetime.utcnow()
    elif item.status != LearningStatus.COMPLETED:
        item.completed_at = None
    db.add(AuditLog(user_id=user.id, action="learning_updated", detail=item.topic))
    db.commit()
    return db.query(LearningItem).options(joinedload(LearningItem.owner)).get(item.id)


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(
    db: Session = Depends(get_work_db),
    user: User = Depends(require_permission("dashboards:view")),
    project_service: ProjectService = Depends(get_project_service),
):
    today = date.today()
    deadline_window_end = today + timedelta(days=3)
    permissions = {permission.code for permission in user.role.permissions}
    visible_projects = project_service.list_projects(user=user, limit=10000, offset=0)
    project_ids = [project.id for project in visible_projects]
    project_by_id = {project.id: project for project in visible_projects}
    task_query = db.query(Task).filter(Task.project_id.in_(project_ids)) if project_ids else db.query(Task).filter(False)
    if "projects:view_assigned" in permissions and "projects:view" not in permissions:
        task_query = task_query.filter(Task.assignee_id == user.id)
    blocker_query = db.query(Blocker).filter(Blocker.project_id.in_(project_ids)) if project_ids else db.query(Blocker).filter(False)
    if "projects:view_assigned" in permissions and "projects:view" not in permissions:
        blocker_query = blocker_query.filter(or_(Blocker.raised_by_id == user.id, Blocker.assignee_id == user.id))

    deadlines: list[DashboardDeadlineOut] = []
    for task in task_query.filter(
        Task.due_date >= today,
        Task.due_date <= deadline_window_end,
        Task.status != TaskStatus.COMPLETED,
    ).all():
        project = project_by_id.get(task.project_id)
        if project and task.due_date:
            deadlines.append(DashboardDeadlineOut(id=f"task-{task.id}", title=task.title, project_id=project.id, project_name=project.name, due_date=task.due_date, kind="Task", critical=task.priority.value == "critical"))

    for project, milestone in db.query(Project, Milestone).join(Milestone, Milestone.project_id == Project.id).filter(
        Project.id.in_(project_ids) if project_ids else False,
        Milestone.due_date >= today, Milestone.due_date <= deadline_window_end,
        Milestone.status != MilestoneStatus.COMPLETED,
    ).all():
        if milestone.due_date:
            deadlines.append(DashboardDeadlineOut(id=f"milestone-{milestone.id}", title=milestone.name, project_id=project.id, project_name=project.name, due_date=milestone.due_date, kind="Milestone", critical=project.priority == ProjectPriority.CRITICAL))

    contributor_query = db.query(Project, ProjectContributor, User).join(ProjectContributor, ProjectContributor.project_id == Project.id).join(User, User.id == ProjectContributor.user_id).filter(
        Project.id.in_(project_ids) if project_ids else False,
        ProjectContributor.end_date >= today, ProjectContributor.end_date <= deadline_window_end,
        ProjectContributor.removed_at.is_(None),
    )
    if "projects:view_assigned" in permissions and "projects:view" not in permissions:
        contributor_query = contributor_query.filter(ProjectContributor.user_id == user.id)
    for project, contributor, member in contributor_query.all():
        deadlines.append(DashboardDeadlineOut(id=f"contributor-{contributor.id}", title=f"{member.full_name or member.email} assignment ends", project_id=project.id, project_name=project.name, due_date=contributor.end_date, kind="Project membership", critical=project.priority == ProjectPriority.CRITICAL))

    team_query = db.query(Project, ProjectTeam, TeamMembership, Team, User).join(ProjectTeam, ProjectTeam.project_id == Project.id).join(Team, Team.id == ProjectTeam.team_id).join(TeamMembership, TeamMembership.team_id == Team.id).join(User, User.id == TeamMembership.user_id).filter(
        Project.id.in_(project_ids) if project_ids else False,
        TeamMembership.end_date >= today, TeamMembership.end_date <= deadline_window_end,
        TeamMembership.left_at.is_(None),
    )
    if "projects:view_assigned" in permissions and "projects:view" not in permissions:
        team_query = team_query.filter(TeamMembership.user_id == user.id)
    for project, _project_team, membership, team, member in team_query.all():
        deadlines.append(DashboardDeadlineOut(id=f"team-{membership.id}-{project.id}", title=f"{member.full_name or member.email} · {team.name} membership ends", project_id=project.id, project_name=project.name, due_date=membership.end_date, kind="Team membership", critical=project.priority == ProjectPriority.CRITICAL))

    deadlines.sort(key=lambda item: (item.due_date, not item.critical, item.project_name.lower()))
    learning_query = db.query(LearningItem).filter(LearningItem.status == LearningStatus.COMPLETED)
    updates_query = db.query(DailyUpdate).filter(DailyUpdate.update_date == today)
    if "projects:view" not in permissions and "users:manage" not in permissions:
        learning_query = learning_query.filter(LearningItem.owner_id == user.id)
        updates_query = updates_query.filter(DailyUpdate.user_id == user.id)
    return DashboardOut(
        active_projects=sum(project.maturity == ProjectMaturity.ACTIVE for project in visible_projects),
        tasks_due_today=task_query.filter(Task.due_date == today, Task.status != TaskStatus.COMPLETED).count(),
        open_tickets=blocker_query.filter(Blocker.status == BlockerStatus.OPEN).count(),
        completed_tasks=task_query.filter(Task.status == TaskStatus.COMPLETED).count(),
        task_total=task_query.count(), learning_completed=learning_query.count(),
        daily_updates_today=updates_query.count(),
        critical_projects=sum(project.priority == ProjectPriority.CRITICAL and project.maturity != ProjectMaturity.COMPLETED for project in visible_projects),
        upcoming_deadlines=deadlines,
    )


@router.get("/exports/{resource}.csv")
def export_resource(resource: str, search: str | None = None, db: Session = Depends(get_work_db), _: User = Depends(require_permission("exports:manage"))):
    if resource == "tasks":
        rows = _task_query(db, search, None, None, _).all()
        headers = ["id", "title", "status", "priority", "due_date", "assignee"]
        values = [[str(row.id), row.title, row.status.value, row.priority.value, row.due_date or "", row.assignee.email if row.assignee else ""] for row in rows]
    elif resource == "daily-updates":
        rows = _daily_query(db, search).all()
        headers = ["id", "date", "user", "summary", "accomplishments", "plans", "tickets"]
        values = [[str(row.id), row.update_date, row.user.email, row.summary, row.accomplishments or "", row.plans or "", row.blockers or ""] for row in rows]
    elif resource == "learning":
        rows = db.query(LearningItem).options(joinedload(LearningItem.owner)).order_by(LearningItem.created_at.desc()).all()
        headers = ["id", "topic", "status", "session_date", "owner"]
        values = [[str(row.id), row.topic, row.status.value, row.session_date or "", row.owner.email] for row in rows]
    else:
        raise HTTPException(status_code=404, detail="Export resource not found")
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    writer.writerows(values)
    return Response(content=output.getvalue(), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={resource}.csv"})
