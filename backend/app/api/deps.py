import uuid

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.repositories.database import SessionLocal
from app.domain.user import User
from app.redis_client import get_redis
from app.repositories.audit_repository import AuditLogRepository
from app.repositories.blocker_repository import BlockerRepository
from app.repositories.project_repository import ProjectRepository
from app.repositories.team_repository import TeamRepository
from app.services.project_service import ProjectService
from app.repositories.role_repository import RoleRepository
from app.repositories.token_repository import RefreshTokenRepository
from app.repositories.user_repository import UserRepository  # type: ignore[reportAttributeAccessIssue]
from app.services.auth_service import AuthService
from app.services.blocker_service import BlockerService
from app.services.permission_service import PermissionService
from app.services.rate_limiter import LoginRateLimiter
from app.services.security import TokenType, decode_token
from app.services.team_service import TeamService
from app.services.user_service import UserService

bearer_scheme = HTTPBearer(auto_error=True)


# --- Session-scoped resources ---

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- Repositories (constructed per-request from the session above) ---

def get_user_repository(db: Session = Depends(get_db)) -> UserRepository:
    return UserRepository(db)


def get_role_repository(db: Session = Depends(get_db)) -> RoleRepository:
    return RoleRepository(db)


def get_token_repository(db: Session = Depends(get_db)) -> RefreshTokenRepository:
    return RefreshTokenRepository(db)


def get_audit_repository(db: Session = Depends(get_db)) -> AuditLogRepository:
    return AuditLogRepository(db)


def get_team_repository(db: Session = Depends(get_db)) -> TeamRepository:
    return TeamRepository(db)


def get_project_repository(db: Session = Depends(get_db)) -> ProjectRepository:
    return ProjectRepository(db)


def get_blocker_repository(db: Session = Depends(get_db)) -> BlockerRepository:
    return BlockerRepository(db)


def get_work_db(db: Session = Depends(get_db)) -> Session:
    return db


# --- Services ---

async def get_rate_limiter() -> LoginRateLimiter:
    redis = await get_redis()
    return LoginRateLimiter(redis)


def get_auth_service(
    users: UserRepository = Depends(get_user_repository),
    tokens: RefreshTokenRepository = Depends(get_token_repository),
    audit: AuditLogRepository = Depends(get_audit_repository),
    rate_limiter: LoginRateLimiter = Depends(get_rate_limiter),
) -> AuthService:
    return AuthService(users, tokens, audit, rate_limiter)


def get_permission_service(roles: RoleRepository = Depends(get_role_repository)) -> PermissionService:
    return PermissionService(roles)


def get_team_service(
    teams: TeamRepository = Depends(get_team_repository),
    users: UserRepository = Depends(get_user_repository),
) -> TeamService:
    return TeamService(teams, users)


def get_project_service(
    projects: ProjectRepository = Depends(get_project_repository),
    users: UserRepository = Depends(get_user_repository),
    teams: TeamRepository = Depends(get_team_repository),
) -> ProjectService:
    return ProjectService(projects, users, teams)


def get_blocker_service(
    blockers: BlockerRepository = Depends(get_blocker_repository),
    projects: ProjectRepository = Depends(get_project_repository),
) -> BlockerService:
    return BlockerService(blockers, projects)


def get_user_service(
    users: UserRepository = Depends(get_user_repository),
    roles: RoleRepository = Depends(get_role_repository),
    tokens: RefreshTokenRepository = Depends(get_token_repository),
) -> UserService:
    return UserService(users, roles, tokens)


# --- Authentication ---

class TokenPayload:
    def __init__(self, user_id: uuid.UUID, role: str, permissions: list[str], jti: str):
        self.user_id = user_id
        self.role = role
        self.permissions = permissions
        self.jti = jti


async def get_token_payload(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> TokenPayload:
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != TokenType.ACCESS.value:
            raise JWTError("wrong token type")
        return TokenPayload(
            user_id=uuid.UUID(payload["sub"]),
            role=payload["role"],
            permissions=payload.get("perms", []),
            jti=payload["jti"],
        )
    except (JWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    token: TokenPayload = Depends(get_token_payload),
    users: UserRepository = Depends(get_user_repository),
) -> User:
    redis = await get_redis()
    if await redis.sismember("revoked_access_jti", token.jti):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session revoked")

    user = users.get_by_id(token.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")

    user._token_permissions = token.permissions  # type: ignore[attr-defined]
    return user


def require_permission(permission_code: str, revalidate_from_db: bool = False):
    """
    Dependency factory for RBAC-protected routes:

        @router.delete("/projects/{id}")
        def delete_project(user: User = Depends(require_permission("projects:manage"))):
            ...

    Pass revalidate_from_db=True for sensitive actions (role edits, user
    deactivation) so a revoked permission takes effect immediately.
    """

    async def dependency(
        request: Request,
        user: User = Depends(get_current_user),
        permission_service: PermissionService = Depends(get_permission_service),
        audit: AuditLogRepository = Depends(get_audit_repository),
    ) -> User:
        granted = permission_service.has_permission(
            user,
            permission_code,
            from_token=getattr(user, "_token_permissions", []),
            revalidate_from_db=revalidate_from_db,
        )
        if not granted:
            audit.record(
                user_id=user.id,
                action="permission_denied",
                detail=f"Missing permission '{permission_code}' for {request.method} {request.url.path}",
                ip_address=request.client.host if request.client else None,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return user

    return dependency


def require_any_permission(*permission_codes: str):
    """Allow a route when the caller has at least one listed permission."""

    async def dependency(
        request: Request,
        user: User = Depends(get_current_user),
        permission_service: PermissionService = Depends(get_permission_service),
        audit: AuditLogRepository = Depends(get_audit_repository),
    ) -> User:
        if any(
            permission_service.has_permission(
                user,
                permission_code,
                from_token=getattr(user, "_token_permissions", []),
            )
            for permission_code in permission_codes
        ):
            return user

        audit.record(
            user_id=user.id,
            action="permission_denied",
            detail=f"Missing any of {permission_codes} for {request.method} {request.url.path}",
            ip_address=request.client.host if request.client else None,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action",
        )

    return dependency
