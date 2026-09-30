import uuid
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field
from app.domain.work import LearningStatus, TaskPriority, TaskStatus

class UserBrief(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str | None
    model_config = ConfigDict(from_attributes=True)

class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    status: TaskStatus = TaskStatus.BACKLOG
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: date | None = None
    project_id: uuid.UUID
    assignee_id: uuid.UUID | None = None
    reviewer_id: uuid.UUID | None = None

class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    due_date: date | None = None
    assignee_id: uuid.UUID | None = None
    reviewer_id: uuid.UUID | None = None

class TaskOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    status: TaskStatus
    priority: TaskPriority
    due_date: date | None
    project_id: uuid.UUID | None
    assignee: UserBrief | None
    reviewer: UserBrief | None
    created_by: UserBrief
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class DailyUpdateCreate(BaseModel):
    update_date: date = Field(default_factory=date.today)
    summary: str = Field(min_length=1)
    accomplishments: str | None = None
    plans: str | None = None
    blockers: str | None = None

class DailyUpdateOut(BaseModel):
    id: uuid.UUID
    update_date: date
    summary: str
    accomplishments: str | None
    plans: str | None
    blockers: str | None
    user: UserBrief
    model_config = ConfigDict(from_attributes=True)

class LearningCreate(BaseModel):
    topic: str = Field(min_length=1, max_length=200)
    notes: str | None = None
    status: LearningStatus = LearningStatus.PLANNED
    session_date: date | None = None

class LearningUpdate(BaseModel):
    topic: str | None = Field(default=None, min_length=1, max_length=200)
    notes: str | None = None
    status: LearningStatus | None = None
    session_date: date | None = None

class LearningOut(BaseModel):
    id: uuid.UUID
    topic: str
    notes: str | None
    status: LearningStatus
    session_date: date | None
    completed_at: datetime | None
    owner: UserBrief
    model_config = ConfigDict(from_attributes=True)

class PageMeta(BaseModel):
    page: int
    page_size: int
    total: int
    pages: int

class TaskPage(BaseModel):
    items: list[TaskOut]
    meta: PageMeta

class DailyUpdatePage(BaseModel):
    items: list[DailyUpdateOut]
    meta: PageMeta

class LearningPage(BaseModel):
    items: list[LearningOut]
    meta: PageMeta

class DashboardDeadlineOut(BaseModel):
    id: str
    title: str
    project_id: uuid.UUID
    project_name: str
    due_date: date
    kind: str
    critical: bool = False

class DashboardOut(BaseModel):
    active_projects: int
    tasks_due_today: int
    open_tickets: int
    completed_tasks: int
    task_total: int
    learning_completed: int
    daily_updates_today: int
    critical_projects: int = 0
    upcoming_deadlines: list[DashboardDeadlineOut] = Field(default_factory=list)
