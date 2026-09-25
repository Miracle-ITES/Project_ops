import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr
from app.domain.invitation import InvitationRequestStatus

class InvitationRequestOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str | None
    role_name: str
    status: InvitationRequestStatus
    requested_by_id: uuid.UUID
    requested_by_name: str | None
    created_at: datetime
    reviewed_at: datetime | None
    review_note: str | None

class InvitationReviewRequest(BaseModel):
    note: str | None = None
