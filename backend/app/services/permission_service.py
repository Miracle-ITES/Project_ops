from app.domain.user import User
from app.repositories.role_repository import RoleRepository


class PermissionService:
    def __init__(self, roles: RoleRepository):
        self.roles = roles

    def has_permission(self, user: User, permission_code: str, *, from_token: list[str] | None = None,
                        revalidate_from_db: bool = False) -> bool:
        """
        By default, trusts the permission snapshot embedded in the access
        JWT at login time (fast, no DB hit). For sensitive actions, pass
        revalidate_from_db=True to re-read the role's current permissions
        from the database so a permission revoked mid-token-lifetime takes
        effect immediately instead of waiting for token expiry.
        """
        if revalidate_from_db:
            self.roles.refresh_permissions(user.role)
            granted = {p.code for p in user.role.permissions}
        else:
            granted = set(from_token or [])
        return permission_code in granted
