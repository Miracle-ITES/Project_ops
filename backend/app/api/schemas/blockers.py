import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.domain.project import BlockerStatus


class BlockerCreateRequest(BaseModel):
    project_id: uuid.UUID
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None


class BlockerStatusUpdateRequest(BaseModel):
    status: BlockerStatus


class BlockerOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    project_name: str
    title: str
    description: str | None
    status: BlockerStatus
    raised_by_id: uuid.UUID
    raised_by_email: str
    created_at: datetime
    resolved_at: datetime | None
