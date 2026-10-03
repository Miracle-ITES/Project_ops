import uuid
import secrets
import string

from app.domain.user import User
from app.repositories.role_repository import RoleRepository
from app.repositories.token_repository import RefreshTokenRepository
from app.repositories.user_repository import UserRepository
from app.services.security import hash_password
from app.services.email_service import send_invitation_email


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

    def __init__(self, users: UserRepository, roles: RoleRepository, tokens: RefreshTokenRepository):
        self.users = users
        self.roles = roles
        self.tokens = tokens

    def invite_user(self, *, email: str, full_name: str | None, role_name: str) -> User:
        if self.users.get_by_email(email):
            raise UserServiceError(f"A user with email '{email}' already exists")
        role = self.roles.get_by_name(role_name)
        if role is None:
            raise UserServiceError(f"Role '{role_name}' does not exist")
        temporary_password = "".join(secrets.choice(string.ascii_letters + string.digits + "!@#$%") for _ in range(16))
        user = self.users.create(
            email=email, hashed_password=hash_password(temporary_password), full_name=full_name,
            role_id=role.id, profile_completed=False,
        )
        try:
            send_invitation_email(recipient=user.email, temporary_password=temporary_password, role_name=role.name)
        except Exception:
            self.users.set_active(user, False)
            raise UserServiceError("User was created but the invitation email could not be sent")
        return self.users.mark_invitation_sent(user)

    def update_profile(self, user: User, *, full_name: str, company_name: str | None = None,
                       job_title: str | None = None, department: str | None = None,
                       phone_number: str | None = None, location: str | None = None) -> User:
        if user.profile_completed:
            raise UserServiceError("Profile details are locked and can only be changed by an administrator")
        return self.users.update_profile(
            user, full_name=full_name, company_name=company_name, job_title=job_title,
            department=department, phone_number=phone_number, location=location,
        )

    def admin_update_profile(self, user_id: uuid.UUID, **profile_fields: str | None) -> User:
        return self.users.update_profile(self.get_user(user_id), **profile_fields)

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

    def change_password(self, user_id: uuid.UUID, password: str) -> User:
        user = self.get_user(user_id)
        updated_user = self.users.update_password(user, hash_password(password))
        self.tokens.revoke_all_for_user(user.id)
        return updated_user
