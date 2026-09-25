import csv
import io
import math
import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_work_db, require_permission
from app.api.schemas.work import (
    DailyUpdateCreate, DailyUpdateOut, DailyUpdatePage, DashboardOut, LearningCreate,
    LearningOut, LearningPage, LearningUpdate, PageMeta, TaskCreate, TaskOut, TaskPage,
    TaskUpdate,
)
from app.domain.project import Blocker, BlockerStatus, Project, ProjectMaturity
from app.domain.user import AuditLog, User
from app.domain.work import DailyUpdate, LearningItem, LearningStatus, Task, TaskStatus

router = APIRouter(tags=["work management"])


def _meta(page: int, page_size: int, total: int) -> PageMeta:
    return PageMeta(page=page, page_size=page_size, total=total, pages=math.ceil(total / page_size) if total else 0)


def _task_query(db: Session, search: str | None, task_status: TaskStatus | None, assignee_id: uuid.UUID | None):
    query = db.query(Task).options(joinedload(Task.assignee), joinedload(Task.reviewer), joinedload(Task.created_by))
    if search:
        query = query.filter(or_(Task.title.ilike(f"%{search}%"), Task.description.ilike(f"%{search}%")))
    if task_status:
        query = query.filter(Task.status == task_status)
    if assignee_id:
        query = query.filter(Task.assignee_id == assignee_id)
    return query.order_by(Task.created_at.desc())


@router.get("/tasks", response_model=TaskPage)
def list_tasks(search: str | None = None, task_status: TaskStatus | None = Query(default=None, alias="status"), assignee_id: uuid.UUID | None = None, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), db: Session = Depends(get_work_db), _: User = Depends(require_permission("projects:view"))):
    query = _task_query(db, search, task_status, assignee_id)
    total = query.count()
    return TaskPage(items=query.offset((page - 1) * page_size).limit(page_size).all(), meta=_meta(page, page_size, total))


@router.post("/tasks", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, db: Session = Depends(get_work_db), user: User = Depends(require_permission("projects:create"))):
    task = Task(**payload.model_dump(), created_by_id=user.id)
    db.add(task)
    db.flush()
    db.add(AuditLog(user_id=user.id, action="task_created", detail=task.title))
    db.commit()
    return db.query(Task).options(joinedload(Task.assignee), joinedload(Task.reviewer), joinedload(Task.created_by)).get(task.id)


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: uuid.UUID, payload: TaskUpdate, db: Session = Depends(get_work_db), user: User = Depends(require_permission("projects:create"))):
    task = db.query(Task).get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(task, field, value)
    db.add(AuditLog(user_id=user.id, action="task_updated", detail=f"{task.title}: {', '.join(changes)}"))
    db.commit()
    return db.query(Task).options(joinedload(Task.assignee), joinedload(Task.reviewer), joinedload(Task.created_by)).get(task.id)


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: uuid.UUID, db: Session = Depends(get_work_db), user: User = Depends(require_permission("projects:create"))):
    task = db.query(Task).get(task_id)
    if not task:
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
def list_daily_updates(search: str | None = None, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), db: Session = Depends(get_work_db), _: User = Depends(require_permission("projects:view"))):
    query = _daily_query(db, search)
    total = query.count()
    return DailyUpdatePage(items=query.offset((page - 1) * page_size).limit(page_size).all(), meta=_meta(page, page_size, total))


@router.post("/daily-updates", response_model=DailyUpdateOut)
def submit_daily_update(payload: DailyUpdateCreate, db: Session = Depends(get_work_db), user: User = Depends(require_permission("projects:view"))):
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
def list_learning(search: str | None = None, learning_status: LearningStatus | None = Query(default=None, alias="status"), page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100), db: Session = Depends(get_work_db), _: User = Depends(require_permission("projects:view"))):
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
def dashboard(db: Session = Depends(get_work_db), _: User = Depends(require_permission("projects:view"))):
    today = date.today()
    return DashboardOut(active_projects=db.query(Project).filter(Project.maturity == ProjectMaturity.ACTIVE).count(), tasks_due_today=db.query(Task).filter(Task.due_date == today, Task.status != TaskStatus.COMPLETED).count(), open_blockers=db.query(Blocker).filter(Blocker.status == BlockerStatus.OPEN).count(), completed_tasks=db.query(Task).filter(Task.status == TaskStatus.COMPLETED).count(), task_total=db.query(Task).count(), learning_completed=db.query(LearningItem).filter(LearningItem.status == LearningStatus.COMPLETED).count(), daily_updates_today=db.query(DailyUpdate).filter(DailyUpdate.update_date == today).count())


@router.get("/exports/{resource}.csv")
def export_resource(resource: str, search: str | None = None, db: Session = Depends(get_work_db), _: User = Depends(require_permission("exports:manage"))):
    if resource == "tasks":
        rows = _task_query(db, search, None, None).all()
        headers = ["id", "title", "status", "priority", "due_date", "assignee"]
        values = [[str(row.id), row.title, row.status.value, row.priority.value, row.due_date or "", row.assignee.email if row.assignee else ""] for row in rows]
    elif resource == "daily-updates":
        rows = _daily_query(db, search).all()
        headers = ["id", "date", "user", "summary", "accomplishments", "plans", "blockers"]
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