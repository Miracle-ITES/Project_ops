"""
All password hashing and token cryptography lives here so it's audited in
one place. Nothing outside this module should touch a raw password, the
JWT secret, or a token's raw bytes.
"""
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from enum import Enum

import bcrypt
from jose import jwt

from app.config import settings


class TokenType(str, Enum):
    ACCESS = "access"
    REFRESH = "refresh"


def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(
        plain_password.encode("utf-8"),
        bcrypt.gensalt(rounds=settings.BCRYPT_ROUNDS),
    ).decode("ascii")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("ascii"))
    except (ValueError, UnicodeEncodeError):
        return False


def create_access_token(user_id: uuid.UUID, role_name: str, permissions: list[str]) -> tuple[str, int]:
    """
    Returns (token, expires_in_seconds). Permissions are embedded so most
    requests don't need a DB round-trip; sensitive routes re-check against
    the DB-backed role anyway (see api/deps.require_permission).
    """
    now = datetime.now(timezone.utc)
    expire_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "role": role_name,
        "perms": permissions,
        "type": TokenType.ACCESS.value,
        "iat": now,
        "exp": now + expire_delta,
        "jti": str(uuid.uuid4()),
    }
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token, int(expire_delta.total_seconds())


def decode_token(token: str) -> dict:
    """Raises jose.JWTError on invalid signature, malformed token, or expiry."""
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


def generate_refresh_token() -> str:
    return uuid.uuid4().hex + uuid.uuid4().hex  # 64 hex chars of randomness


def hash_refresh_token(raw_token: str) -> str:
    """Only this hash is ever stored — a DB leak alone can't be replayed."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def refresh_token_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
