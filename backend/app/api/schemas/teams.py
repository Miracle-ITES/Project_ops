import uuid
from datetime import date, datetime

from pydantic import BaseModel, EmailStr


class TeamCreateRequest(BaseModel):
    name: str
    description: str | None = None


class TeamOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class TeamMemberAddRequest(BaseModel):
    user_id: uuid.UUID
    end_date: date | None = None


class RosterMemberOut(BaseModel):
    user_id: uuid.UUID
    email: EmailStr
    full_name: str | None
    role_name: str
    joined_at: datetime
    end_date: date | None
    team_count: int


class TeamRosterOut(BaseModel):
    team: TeamOut
    members: list[RosterMemberOut]


class TeamMembershipHistoryOut(BaseModel):
    user_id: uuid.UUID
    email: EmailStr
    full_name: str | None
    role_name: str
    joined_at: datetime
    end_date: date | None
    left_at: datetime | None


class MyTeamMemberOut(BaseModel):
    user_id: uuid.UUID
    email: EmailStr
    full_name: str | None
    role_name: str
    is_active: bool
    team_names: list[str]
