import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_audit_repository, get_current_user, get_user_service, require_any_permission, require_permission
from app.api.schemas.users import UserActiveChangeRequest, UserCreateRequest, UserListItemOut, UserProfileUpdateRequest, UserRoleChangeRequest
from app.domain.user import User
from app.repositories.audit_repository import AuditLogRepository
from app.services.user_service import UserService, UserServiceError

router = APIRouter(prefix="/users", tags=["users"])


def _to_out(user: User) -> UserListItemOut:
    return UserListItemOut(
        id=user.id, email=user.email, full_name=user.full_name, is_active=user.is_active,
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
