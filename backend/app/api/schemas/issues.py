import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator

from app.domain.issue import IssuePriority, IssueSeverity, IssueSource, IssueStatus


class IssueCreate(BaseModel):
    project_id: uuid.UUID
    task_id: uuid.UUID | None = None
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    type: str = Field(default="issue", min_length=1, max_length=40)
    category: str = Field(default="general", min_length=1, max_length=60)
    priority: IssuePriority = IssuePriority.MEDIUM
    severity: IssueSeverity = IssueSeverity.MEDIUM
    assignee_id: uuid.UUID | None = None
    due_date: date | None = None


class TaskIssueCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    type: str = Field(default="issue", min_length=1, max_length=40)
    category: str = Field(default="general", min_length=1, max_length=60)
    priority: IssuePriority = IssuePriority.MEDIUM
    severity: IssueSeverity = IssueSeverity.MEDIUM
    assignee_id: uuid.UUID | None = None
    due_date: date | None = None


class IssueUpdate(BaseModel):
    status: IssueStatus | None = None
    priority: IssuePriority | None = None
    severity: IssueSeverity | None = None
    assignee_id: uuid.UUID | None = None
    due_date: date | None = None
    resolution: str | None = None


class IssueOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    project_name: str
    task_id: uuid.UUID | None
    task_title: str | None
    title: str
    description: str | None
    type: str
    category: str
    priority: IssuePriority
    severity: IssueSeverity
    status: IssueStatus
    reporter_id: uuid.UUID
    reporter_name: str
    assignee_id: uuid.UUID | None
    assignee_name: str | None
    source: IssueSource
    due_date: date | None
    resolution: str | None
    resolved_by_id: uuid.UUID | None
    resolved_at: datetime | None
    escalated_to_blocker_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class IssuePage(BaseModel):
    items: list[IssueOut]
    page: int
    page_size: int
    total: int
    pages: int


class IssueCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)

    @field_validator("body")
    @classmethod
    def body_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Comment cannot be blank")
        return value


class IssueCommentOut(BaseModel):
    id: uuid.UUID
    issue_id: uuid.UUID
    author_id: uuid.UUID | None
    author_name: str
    body: str
    created_at: datetime


class IssueHistoryOut(BaseModel):
    id: uuid.UUID
    issue_id: uuid.UUID
    actor_id: uuid.UUID | None
    actor_name: str
    event_type: str
    detail: str
    created_at: datetime
