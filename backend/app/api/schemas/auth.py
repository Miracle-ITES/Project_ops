import uuid

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class RoleOut(BaseModel):
    id: uuid.UUID
    name: str
    permissions: list[str]

    class Config:
        from_attributes = True


class UserOut(BaseModel):
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
