import uuid

from pydantic import BaseModel, EmailStr, Field

from app.api.schemas.auth import RoleOut


class UserCreateRequest(BaseModel):
    email: EmailStr
    full_name: str | None = None
    role_name: str


class UserRoleChangeRequest(BaseModel):
    role_name: str


class UserActiveChangeRequest(BaseModel):
    is_active: bool


class UserProfileUpdateRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    company_name: str | None = Field(default=None, max_length=255)
    job_title: str | None = Field(default=None, max_length=255)
    department: str | None = Field(default=None, max_length=255)
    phone_number: str | None = Field(default=None, max_length=50)
    location: str | None = Field(default=None, max_length=255)


class UserListItemOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str | None
    is_active: bool
    profile_completed: bool
    company_name: str | None
    job_title: str | None
    department: str | None
    phone_number: str | None
    location: str | None
    role: RoleOut

    class Config:
        from_attributes = True
