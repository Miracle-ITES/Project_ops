import uuid

from app.domain.user import User
from app.repositories.role_repository import RoleRepository
from app.repositories.user_repository import UserRepository
from app.services.security import hash_password


class UserServiceError(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class UserService:
    """
    Admin-only user provisioning, per your Administrator/Users&Teams model:
    accounts are created by an admin (see Phase 2 discussion), not via
    self-registration.
    """

    def __init__(self, users: UserRepository, roles: RoleRepository):
        self.users = users
        self.roles = roles

    def create_user(self, *, email: str, password: str, full_name: str | None, role_name: str) -> User:
        if self.users.get_by_email(email):
            raise UserServiceError(f"A user with email '{email}' already exists")
        role = self.roles.get_by_name(role_name)
        if role is None:
            raise UserServiceError(f"Role '{role_name}' does not exist")
        return self.users.create(
            email=email, hashed_password=hash_password(password), full_name=full_name, role_id=role.id,
        )

    def list_users(self) -> list[User]:
        return self.users.list_all()

    def get_user(self, user_id: uuid.UUID) -> User:
        user = self.users.get_by_id(user_id)
        if user is None:
            raise UserServiceError("User not found")
        return user

    def change_role(self, user_id: uuid.UUID, role_name: str) -> User:
        user = self.get_user(user_id)
        role = self.roles.get_by_name(role_name)
        if role is None:
            raise UserServiceError(f"Role '{role_name}' does not exist")
        return self.users.update_role(user, role.id)

    def set_active(self, user_id: uuid.UUID, is_active: bool) -> User:
        user = self.get_user(user_id)
        return self.users.set_active(user, is_active)
