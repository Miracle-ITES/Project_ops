import uuid
from datetime import datetime

from sqlalchemy.orm import joinedload

from app.domain.user import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository):
    def get_by_id(self, user_id: uuid.UUID) -> User | None:
        return (
            self.db.query(User)
            .options(joinedload(User.role))
            .filter(User.id == user_id)
            .first()
        )

    def get_by_email(self, email: str) -> User | None:
        return (
            self.db.query(User)
            .options(joinedload(User.role))
            .filter(User.email == email.lower())
            .first()
        )

    def create(
        self, *, email: str, hashed_password: str, full_name: str | None, role_id: uuid.UUID,
        profile_completed: bool = True,
    ) -> User:
        user = User(
            email=email.lower(),
            hashed_password=hashed_password,
            full_name=full_name,
            role_id=role_id,
            profile_completed=profile_completed,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def list_all(self) -> list[User]:
        return self.db.query(User).options(joinedload(User.role)).order_by(User.created_at.desc()).all()

    def update_role(self, user: User, role_id: uuid.UUID) -> User:
        user.role_id = role_id
        self.db.commit()
        self.db.refresh(user)
        return user

    def set_active(self, user: User, is_active: bool) -> User:
        user.is_active = is_active
        self.db.commit()
        self.db.refresh(user)
        return user

    def update_profile(
        self, user: User, *, full_name: str, company_name: str | None = None,
        job_title: str | None = None, department: str | None = None,
        phone_number: str | None = None, location: str | None = None,
    ) -> User:
        user.full_name = full_name
        user.company_name = company_name
        user.job_title = job_title
        user.department = department
        user.phone_number = phone_number
        user.location = location
        user.profile_completed = True
        self.db.commit()
        self.db.refresh(user)
        return user

    def mark_invitation_sent(self, user: User) -> User:
        user.invitation_sent_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(user)
        return user
