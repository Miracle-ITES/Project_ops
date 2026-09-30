import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_audit_repository, get_current_user, get_db, get_user_service, require_any_permission, require_permission
from app.api.schemas.invitations import InvitationRequestOut, InvitationReviewRequest
from app.api.schemas.users import UserActiveChangeRequest, UserCreateRequest, UserListItemOut, UserProfileUpdateRequest, UserRoleChangeRequest
from app.domain.invitation import InvitationRequest, InvitationRequestStatus
from app.domain.user import User
from app.repositories.audit_repository import AuditLogRepository
from app.services.user_service import UserService, UserServiceError

router = APIRouter(prefix="/users", tags=["users"])


def _request_out(request: InvitationRequest) -> InvitationRequestOut:
    return InvitationRequestOut(
        id=request.id, email=request.email, full_name=request.full_name,
        role_name=request.role_name, status=request.status,
        requested_by_id=request.requested_by_id,
        requested_by_name=(request.requested_by.full_name or request.requested_by.email) if request.requested_by else None,
        created_at=request.created_at, reviewed_at=request.reviewed_at,
        review_note=request.review_note,
    )


def _to_out(user: User) -> UserListItemOut:
    return UserListItemOut(
        id=user.id, created_at=user.created_at, email=user.email, full_name=user.full_name, is_active=user.is_active,
        profile_completed=user.profile_completed,
        company_name=user.company_name, job_title=user.job_title, department=user.department,
        phone_number=user.phone_number, location=user.location,
        role={"id": user.role.id, "name": user.role.name, "permissions": [p.code for p in user.role.permissions]},
    )


@router.post("", response_model=UserListItemOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreateRequest,
    user_service: UserService = Depends(get_user_service),
    current_user: User = Depends(require_permission("users:manage")),
    audit: AuditLogRepository = Depends(get_audit_repository),
):
    try:
        user = user_service.invite_user(email=payload.email, full_name=payload.full_name, role_name=payload.role_name)
    except UserServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message)
    audit.record(user_id=current_user.id, action="user_invited", detail=f"Invited {user.email} as {user.role.name}")
    return _to_out(user)


@router.post("/requests", response_model=InvitationRequestOut, status_code=status.HTTP_201_CREATED)
def request_user_invitation(
    payload: UserCreateRequest,
    current_user: User = Depends(require_any_permission("users:manage", "users:request")),
    audit: AuditLogRepository = Depends(get_audit_repository),
    db: Session = Depends(get_db),
):
    if current_user.role.name != "Administrator" and payload.role_name == "Administrator":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only an administrator can create an Administrator account")
    email = str(payload.email).lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"A user with email '{email}' already exists")
    pending = db.query(InvitationRequest).filter(
        InvitationRequest.email == email,
        InvitationRequest.status == InvitationRequestStatus.PENDING,
    ).first()
    if pending:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="An invitation request for this email is already pending")
    request = InvitationRequest(email=email, full_name=payload.full_name, role_name=payload.role_name, requested_by_id=current_user.id)
    db.add(request)
    db.flush()
    audit.record(user_id=current_user.id, action="user_invitation_requested", detail=f"Requested {email} as {payload.role_name}")
    db.refresh(request)
    return _request_out(request)


@router.get("/requests", response_model=list[InvitationRequestOut])
def list_invitation_requests(db: Session = Depends(get_db), _: User = Depends(require_permission("users:manage"))):
    requests = db.query(InvitationRequest).options(joinedload(InvitationRequest.requested_by)).order_by(InvitationRequest.created_at.desc()).all()
    return [_request_out(request) for request in requests]


@router.get("/requests/mine", response_model=list[InvitationRequestOut])
def list_my_invitation_requests(db: Session = Depends(get_db), current_user: User = Depends(require_any_permission("users:manage", "users:request"))):
    requests = db.query(InvitationRequest).options(joinedload(InvitationRequest.requested_by)).filter(
        InvitationRequest.requested_by_id == current_user.id
    ).order_by(InvitationRequest.created_at.desc()).all()
    return [_request_out(request) for request in requests]


@router.post("/requests/{request_id}/approve", response_model=UserListItemOut)
def approve_invitation_request(
    request_id: uuid.UUID,
    review: InvitationReviewRequest,
    db: Session = Depends(get_db),
    user_service: UserService = Depends(get_user_service),
    admin: User = Depends(require_permission("users:manage", revalidate_from_db=True)),
    audit: AuditLogRepository = Depends(get_audit_repository),
):
    request = db.query(InvitationRequest).options(joinedload(InvitationRequest.requested_by)).get(request_id)
    if request is None or request.status != InvitationRequestStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pending invitation request not found")
    try:
        user = user_service.invite_user(email=request.email, full_name=request.full_name, role_name=request.role_name)
    except UserServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message)
    request.status = InvitationRequestStatus.APPROVED
    request.reviewed_by_id = admin.id
    request.review_note = review.note
    request.reviewed_at = datetime.utcnow()
    db.commit()
    audit.record(user_id=admin.id, action="user_invitation_approved", detail=f"Approved {request.email}")
    return _to_out(user)


@router.post("/requests/{request_id}/reject", response_model=InvitationRequestOut)
def reject_invitation_request(
    request_id: uuid.UUID,
    review: InvitationReviewRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_permission("users:manage", revalidate_from_db=True)),
    audit: AuditLogRepository = Depends(get_audit_repository),
):
    request = db.query(InvitationRequest).options(joinedload(InvitationRequest.requested_by)).get(request_id)
    if request is None or request.status != InvitationRequestStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pending invitation request not found")
    request.status = InvitationRequestStatus.REJECTED
    request.reviewed_by_id = admin.id
    request.review_note = review.note
    request.reviewed_at = datetime.utcnow()
    db.commit()
    audit.record(user_id=admin.id, action="user_invitation_rejected", detail=f"Rejected {request.email}")
    return _request_out(request)


@router.patch("/me/profile", response_model=UserListItemOut)
def update_my_profile(
    payload: UserProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service),
):
    try:
        return _to_out(user_service.update_profile(
            current_user, full_name=payload.full_name, company_name=payload.company_name,
            job_title=payload.job_title, department=payload.department,
            phone_number=payload.phone_number, location=payload.location,
        ))
    except UserServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message)


@router.patch("/{user_id}/profile", response_model=UserListItemOut)
def admin_update_profile(
    user_id: uuid.UUID,
    payload: UserProfileUpdateRequest,
    user_service: UserService = Depends(get_user_service),
    _: User = Depends(require_permission("users:manage")),
):
    try:
        return _to_out(user_service.admin_update_profile(
            user_id, full_name=payload.full_name, company_name=payload.company_name,
            job_title=payload.job_title, department=payload.department,
            phone_number=payload.phone_number, location=payload.location,
        ))
    except UserServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message)


@router.get("", response_model=list[UserListItemOut])
def list_users(
    user_service: UserService = Depends(get_user_service),
    _: User = Depends(require_permission("users:manage")),
):
    return [_to_out(u) for u in user_service.list_users()]


@router.get("/assignable", response_model=list[UserListItemOut])
def list_assignable_users(
    user_service: UserService = Depends(get_user_service),
    _: User = Depends(require_any_permission("users:manage", "teams:manage", "projects:create")),
):
    return [_to_out(u) for u in user_service.list_users()]


@router.get("/{user_id}", response_model=UserListItemOut)
def get_user(
    user_id: uuid.UUID,
    user_service: UserService = Depends(get_user_service),
    _: User = Depends(require_permission("users:manage")),
):
    try:
        return _to_out(user_service.get_user(user_id))
    except UserServiceError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)


@router.patch("/{user_id}/role", response_model=UserListItemOut)
def change_role(
    user_id: uuid.UUID,
    payload: UserRoleChangeRequest,
    user_service: UserService = Depends(get_user_service),
    # revalidate_from_db not needed here — this route itself is the source
    # of truth change; the *next* request from the affected user picks up
    # the new role via a fresh /auth/refresh.
    _: User = Depends(require_permission("users:manage")),
):
    try:
        return _to_out(user_service.change_role(user_id, payload.role_name))
    except UserServiceError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message)


@router.patch("/{user_id}/active", response_model=UserListItemOut)
def set_active(
    user_id: uuid.UUID,
    payload: UserActiveChangeRequest,
    user_service: UserService = Depends(get_user_service),
    _: User = Depends(require_permission("users:manage", revalidate_from_db=True)),
):
    try:
        return _to_out(user_service.set_active(user_id, payload.is_active))
    except UserServiceError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)
