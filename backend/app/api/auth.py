from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api.deps import get_auth_service, get_current_user
from app.api.schemas.auth import LoginRequest, LogoutRequest, RefreshRequest, RoleOut, TokenResponse, UserOut
from app.domain.user import User
from app.services.auth_service import AuthError, AuthService, LockedOutError

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, request: Request, auth_service: AuthService = Depends(get_auth_service)):
    try:
        tokens = await auth_service.login(
            email=payload.email,
            password=payload.password,
            ip_address=_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
    except LockedOutError:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please try again later.",
        )
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=exc.message)

    return TokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, request: Request, auth_service: AuthService = Depends(get_auth_service)):
    try:
        tokens = auth_service.refresh(
            raw_refresh_token=payload.refresh_token,
            ip_address=_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=exc.message)

    return TokenResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        expires_in=tokens.expires_in,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: LogoutRequest, auth_service: AuthService = Depends(get_auth_service)):
    auth_service.logout(raw_refresh_token=payload.refresh_token)
    return None


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    # Built explicitly rather than via from_attributes: Role.permissions is
    # a list of Permission ORM objects, not the list[str] the schema wants.
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        profile_completed=user.profile_completed,
        company_name=user.company_name,
        job_title=user.job_title,
        department=user.department,
        phone_number=user.phone_number,
        location=user.location,
        role=RoleOut(
            id=user.role.id,
            name=user.role.name,
            permissions=[p.code for p in user.role.permissions],
        ),
    )
