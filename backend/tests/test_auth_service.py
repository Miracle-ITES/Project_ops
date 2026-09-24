import asyncio
import hashlib
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.services.auth_service import AuthError, AuthService
from app.services.security import hash_password, verify_password


class FakeRateLimiter:
    def __init__(self):
        self.attempts = []
        self.locked = False

    async def raise_if_locked_out(self, identifier):
        if self.locked:
            raise RuntimeError("locked")

    async def record_attempt(self, identifier, success):
        self.attempts.append((identifier, success))


class FakeAudit:
    def __init__(self):
        self.events = []

    def record(self, **event):
        self.events.append(event)


class FakeTokens:
    def __init__(self):
        self.records = {}
        self.revoked_all_for = []

    def create(self, **kwargs):
        record = SimpleNamespace(
            id=uuid4(),
            **kwargs,
            revoked=False,
        )
        self.records[kwargs["token_hash"]] = record
        return record

    def get_by_hash(self, token_hash):
        return self.records.get(token_hash)

    def revoke(self, record):
        record.revoked = True

    def revoke_all_for_user(self, user_id):
        self.revoked_all_for.append(user_id)
        for record in self.records.values():
            if record.user_id == user_id:
                record.revoked = True


class FakeUsers:
    def __init__(self, user):
        self.user = user

    def get_by_email(self, email):
        return self.user if self.user and self.user.email == email.lower() else None

    def get_by_id(self, user_id):
        return self.user if self.user and self.user.id == user_id else None


def make_user(active=True):
    role = SimpleNamespace(name="Member", permissions=[SimpleNamespace(code="projects:view")])
    return SimpleNamespace(
        id=uuid4(),
        email="person@example.com",
        hashed_password=hash_password("correct password"),
        is_active=active,
        role=role,
    )


def make_service(user):
    tokens = FakeTokens()
    audit = FakeAudit()
    service = AuthService(FakeUsers(user), tokens, audit, FakeRateLimiter())
    return service, tokens, audit


def test_bcrypt_hashing_and_long_password_failure():
    hashed = hash_password("correct password")
    assert verify_password("correct password", hashed)
    assert not verify_password("x" * 256, hashed)


def test_unknown_email_uses_generic_login_error_and_audit():
    service, _, audit = make_service(None)

    with pytest.raises(AuthError, match="Incorrect email or password"):
        asyncio.run(service.login(
            email="missing@example.com",
            password="wrong password",
            ip_address="127.0.0.1",
            user_agent=None,
        ))

    assert audit.events[-1]["action"] == "login_failed"
    assert audit.events[-1]["user_id"] is None


def test_inactive_user_is_rejected_by_administrator():
    service, _, _ = make_service(make_user(active=False))

    with pytest.raises(AuthError, match="Access denied by administrator"):
        asyncio.run(service.login(
            email="person@example.com",
            password="correct password",
            ip_address=None,
            user_agent=None,
        ))


def test_refresh_rotates_token_and_reuse_revokes_all_tokens():
    user = make_user()
    service, tokens, audit = make_service(user)
    first = asyncio.run(service.login(
        email=user.email,
        password="correct password",
        ip_address=None,
        user_agent=None,
    ))

    second = service.refresh(raw_refresh_token=first.refresh_token, ip_address=None, user_agent=None)
    first_record = tokens.records[next(key for key, value in tokens.records.items() if value.revoked)]
    assert first_record.revoked
    assert second.refresh_token != first.refresh_token

    with pytest.raises(AuthError, match="Invalid or expired refresh token"):
        service.refresh(raw_refresh_token=first.refresh_token, ip_address=None, user_agent=None)

    assert tokens.revoked_all_for == [user.id]
    assert audit.events[-1]["action"] == "refresh_token_reuse_detected"


def test_expired_refresh_token_is_rejected():
    user = make_user()
    service, tokens, _ = make_service(user)
    raw_token = "expired-token"
    tokens.create(
        user_id=user.id,
        token_hash=hashlib.sha256(raw_token.encode()).hexdigest(),
        expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),
        user_agent=None,
        ip_address=None,
    )

    with pytest.raises(AuthError, match="Invalid or expired refresh token"):
        service.refresh(raw_refresh_token=raw_token, ip_address=None, user_agent=None)
