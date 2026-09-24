import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from app.domain.user import User
from app.repositories.audit_repository import AuditLogRepository
from app.repositories.token_repository import RefreshTokenRepository
from app.repositories.user_repository import UserRepository
from app.services.rate_limiter import LoginRateLimiter, RateLimitExceeded
from app.services.security import (
    create_access_token,
    generate_refresh_token,
    hash_refresh_token,
    refresh_token_expiry,
    verify_password,
)

GENERIC_LOGIN_ERROR = "Incorrect email or password"

# Precomputed bcrypt hash of a random value — compared against on the
# "email not found" path so response timing doesn't reveal which emails
# are registered.
DUMMY_HASH = "$2b$12$zb.KUYHPqxwwiApfO8XkA.K/dvYHLg/xOGRw6l9aEAQngZO55wOJ."


class AuthError(Exception):
    def __init__(self, message: str = GENERIC_LOGIN_ERROR):
        super().__init__(message)
        self.message = message


class LockedOutError(Exception):
    pass


@dataclass
class TokenPair:
    access_token: str
    refresh_token: str
    expires_in: int


class AuthService:
    """
    Business logic layer for authentication — routes call this, never the
    repositories or security primitives directly. Constructed per-request
    with its repositories and rate limiter injected (see api/deps.py).
    """

    def __init__(
        self,
        users: UserRepository,
        tokens: RefreshTokenRepository,
        audit: AuditLogRepository,
        rate_limiter: LoginRateLimiter,
    ):
        self.users = users
        self.tokens = tokens
        self.audit = audit
        self.rate_limiter = rate_limiter

    async def login(self, *, email: str, password: str, ip_address: str | None,
                     user_agent: str | None) -> TokenPair:
        identifier = f"{email.lower()}:{ip_address or 'unknown'}"

        try:
            await self.rate_limiter.raise_if_locked_out(identifier)
        except RateLimitExceeded:
            raise LockedOutError()

        user = self.users.get_by_email(email)

        # Constant-shape failure path: always run a password verification,
        # even against a dummy hash when no user exists, and always raise
        # the same error either way.
        password_ok = verify_password(password, user.hashed_password if user else DUMMY_HASH)

        if not user or not password_ok:
            try:
                await self.rate_limiter.record_attempt(identifier, success=False)
            except RateLimitExceeded:
                self.audit.record(user_id=user.id if user else None, action="login_locked_out", ip_address=ip_address)
                raise LockedOutError()
            finally:
                self.audit.record(user_id=user.id if user else None, action="login_failed", ip_address=ip_address)
            raise AuthError()

        if not user.is_active:
            await self.rate_limiter.record_attempt(identifier, success=False)
            self.audit.record(user_id=user.id, action="login_denied_inactive", ip_address=ip_address)
            raise AuthError("Access denied by administrator")

        await self.rate_limiter.record_attempt(identifier, success=True)
        self.audit.record(user_id=user.id, action="login_success", ip_address=ip_address)

        return self._issue_tokens(user, ip_address=ip_address, user_agent=user_agent)

    def refresh(self, *, raw_refresh_token: str, ip_address: str | None, user_agent: str | None) -> TokenPair:
        token_hash = hash_refresh_token(raw_refresh_token)
        record = self.tokens.get_by_hash(token_hash)
        if record is None:
            raise AuthError("Invalid or expired refresh token")

        if record.revoked:
            self.tokens.revoke_all_for_user(record.user_id)
            self.audit.record(
                user_id=record.user_id,
                action="refresh_token_reuse_detected",
                ip_address=ip_address,
            )
            raise AuthError("Invalid or expired refresh token")

        expires_at = record.expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= datetime.now(timezone.utc):
            raise AuthError("Invalid or expired refresh token")

        user = self.users.get_by_id(record.user_id)
        if user is None or not user.is_active:
            raise AuthError("Invalid or expired refresh token")

        # Rotate: revoke the used token before issuing a new pair, so a
        # stolen-but-unused refresh token becomes worthless the moment the
        # legitimate client uses theirs. Reuse of an already-revoked token
        # is itself a theft signal worth flagging.
        self.tokens.revoke(record)
        self.audit.record(user_id=user.id, action="token_refreshed", ip_address=ip_address)

        return self._issue_tokens(user, ip_address=ip_address, user_agent=user_agent)

    def logout(self, *, raw_refresh_token: str) -> None:
        token_hash = hash_refresh_token(raw_refresh_token)
        record = self.tokens.get_by_hash(token_hash)
        if record and not record.revoked:
            self.tokens.revoke(record)
        # No branch on "token not found" — logout is always a no-op success
        # from the caller's perspective, so it never reveals token validity.

    def _issue_tokens(self, user: User, *, ip_address: str | None, user_agent: str | None) -> TokenPair:
        permissions = [p.code for p in user.role.permissions]
        access_token, expires_in = create_access_token(user.id, user.role.name, permissions)

        raw_refresh = generate_refresh_token()
        self.tokens.create(
            user_id=user.id,
            token_hash=hash_refresh_token(raw_refresh),
            expires_at=refresh_token_expiry(),
            user_agent=(user_agent or "")[:255],
            ip_address=ip_address,
        )
        return TokenPair(access_token=access_token, refresh_token=raw_refresh, expires_in=expires_in)
