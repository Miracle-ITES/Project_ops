import uuid

from pydantic import BaseModel, EmailStr, Field

from app.api.schemas.auth import RoleOut


class UserCreateRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=256)
    full_name: str | None = None
    role_name: str


class UserRoleChangeRequest(BaseModel):
    role_name: str


class UserActiveChangeRequest(BaseModel):
    is_active: bool


class UserListItemOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str | None
    is_active: bool
    role: RoleOut

    class Config:
        from_attributes = True
