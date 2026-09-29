import uuid
from datetime import datetime

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


class RosterMemberOut(BaseModel):
    user_id: uuid.UUID
    email: EmailStr
    full_name: str | None
    role_name: str
    joined_at: datetime
    team_count: int


class TeamRosterOut(BaseModel):
    team: TeamOut
    members: list[RosterMemberOut]


class MyTeamMemberOut(BaseModel):
    user_id: uuid.UUID
    email: EmailStr
    full_name: str | None
    role_name: str
    is_active: bool
    team_names: list[str]
