from app.domain.user import Permission, Role
from app.repositories.base import BaseRepository


class RoleRepository(BaseRepository):
    def get_by_name(self, name: str) -> Role | None:
        return self.db.query(Role).filter(Role.name == name).first()

    def get_all(self) -> list[Role]:
        return self.db.query(Role).all()

    def refresh_permissions(self, role: Role) -> None:
        """Re-reads a role's permissions from the DB, bypassing any stale
        in-session/ORM identity-map cache — used for revalidate_from_db
        permission checks on sensitive routes."""
        self.db.refresh(role, attribute_names=["permissions"])


class PermissionRepository(BaseRepository):
    def get_by_code(self, code: str) -> Permission | None:
        return self.db.query(Permission).filter(Permission.code == code).first()

    def get_or_create(self, code: str, description: str) -> Permission:
        perm = self.get_by_code(code)
        if perm is None:
            perm = Permission(code=code, description=description)
            self.db.add(perm)
            self.db.flush()
        return perm
