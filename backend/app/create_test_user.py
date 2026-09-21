"""
Creates a single user, for local testing only (no public registration
endpoint exists yet — see Phase 2 "not yet done" notes).

Usage:
    python -m app.create_test_user you@example.com yourpassword "Administrator"

Role name must be one of: Administrator, Lead/Manager, Member, Viewer/Auditor
(seeded by app.seed_roles).
"""
import sys

from app.repositories.database import SessionLocal
from app.repositories.role_repository import RoleRepository
from app.repositories.user_repository import UserRepository
from app.services.security import hash_password


def main():
    if len(sys.argv) != 4:
        print('Usage: python -m app.create_test_user <email> <password> "<role name>"')
        sys.exit(1)

    email, password, role_name = sys.argv[1], sys.argv[2], sys.argv[3]

    db = SessionLocal()
    try:
        role_repo = RoleRepository(db)
        role = role_repo.get_by_name(role_name)
        if role is None:
            print(f"Role '{role_name}' not found. Run `python -m app.seed_roles` first.")
            sys.exit(1)

        user_repo = UserRepository(db)
        if user_repo.get_by_email(email):
            print(f"User {email} already exists.")
            sys.exit(1)

        user = user_repo.create(
            email=email,
            hashed_password=hash_password(password),
            full_name=None,
            role_id=role.id,
        )
        print(f"Created user {user.email} with role {role.name}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
