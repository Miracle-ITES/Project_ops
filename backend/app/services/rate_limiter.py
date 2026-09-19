from redis.asyncio import Redis

from app.config import settings


class RateLimitExceeded(Exception):
    pass


class LoginRateLimiter:
    """
    Sliding-window brute-force guard keyed on email+IP. After
    LOGIN_RATE_LIMIT_ATTEMPTS failures within the window, further attempts
    are rejected for a lockout period, independent of whether the correct
    password is later supplied.
    """

    def __init__(self, redis: Redis):
        self.redis = redis

    async def raise_if_locked_out(self, identifier: str) -> None:
        """Cheap pre-check called before any password hashing, so a
        locked-out identifier can't burn CPU cycles via repeated bcrypt calls."""
        if await self.redis.exists(f"login_lockout:{identifier}"):
            raise RateLimitExceeded()

    async def record_attempt(self, identifier: str, success: bool) -> None:
        attempts_key = f"login_attempts:{identifier}"
        lockout_key = f"login_lockout:{identifier}"

        if await self.redis.exists(lockout_key):
            raise RateLimitExceeded()

        if success:
            await self.redis.delete(attempts_key)
            return

        attempts = await self.redis.incr(attempts_key)
        if attempts == 1:
            await self.redis.expire(attempts_key, settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS)

        if attempts >= settings.LOGIN_RATE_LIMIT_ATTEMPTS:
            await self.redis.set(lockout_key, "1", ex=settings.LOGIN_LOCKOUT_SECONDS)
            await self.redis.delete(attempts_key)
            raise RateLimitExceeded()
