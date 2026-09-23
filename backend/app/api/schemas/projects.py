import uuid
from datetime import date, datetime

from pydantic import BaseModel, EmailStr

from app.domain.project import MilestoneStatus, ProjectMaturity, ProjectPriority


class ProjectCreateRequest(BaseModel):
    name: str
    description: str | None = None
    owner_id: uuid.UUID | None = None  # defaults to the requesting user if omitted
    priority: ProjectPriority = ProjectPriority.MEDIUM
    maturity: ProjectMaturity = ProjectMaturity.PLANNING


class ProjectUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    priority: ProjectPriority | None = None
    maturity: ProjectMaturity | None = None


class ContributorAddRequest(BaseModel):
    user_id: uuid.UUID


class MilestoneCreateRequest(BaseModel):
    name: str
    due_date: date | None = None
    status: MilestoneStatus = MilestoneStatus.PENDING


class OwnerOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str | None

    class Config:
        from_attributes = True


class MilestoneOut(BaseModel):
    id: uuid.UUID
    name: str
    due_date: date | None
    status: MilestoneStatus
    created_at: datetime

    class Config:
        from_attributes = True


class ProjectListItemOut(BaseModel):
    id: uuid.UUID
    name: str
    priority: ProjectPriority
    maturity: ProjectMaturity
    owner: OwnerOut
    created_at: datetime

    class Config:
        from_attributes = True


class ContributorOut(BaseModel):
    user_id: uuid.UUID
    email: EmailStr
    full_name: str | None


class ProjectTeamOut(BaseModel):
    team_id: uuid.UUID
    name: str
    description: str | None


class ProjectTeamAddRequest(BaseModel):
    team_id: uuid.UUID


class ProjectDetailOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    priority: ProjectPriority
    maturity: ProjectMaturity
    owner: OwnerOut
    contributors: list[ContributorOut]
    teams: list[ProjectTeamOut]
    milestones: list[MilestoneOut]
    created_at: datetime
    updated_at: datetime
