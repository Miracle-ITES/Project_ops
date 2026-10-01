import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.domain.project import BlockerStatus


class BlockerCreateRequest(BaseModel):
    project_id: uuid.UUID
    task_id: uuid.UUID | None = None
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    assignee_id: uuid.UUID | None = None


class BlockerAssigneeUpdateRequest(BaseModel):
    assignee_id: uuid.UUID | None = None


class BlockerStatusUpdateRequest(BaseModel):
    status: BlockerStatus


class BlockerOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    task_id: uuid.UUID | None
    task_title: str | None
    project_name: str
    title: str
    description: str | None
    status: BlockerStatus
    raised_by_id: uuid.UUID
    raised_by_email: str
    assignee_id: uuid.UUID | None
    assignee_email: str | None
    created_at: datetime
    resolved_at: datetime | None


class BlockerPage(BaseModel):
    items: list[BlockerOut]
    page: int
    page_size: int
    total: int
    pages: int
