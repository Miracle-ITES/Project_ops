import uuid
from datetime import datetime, timezone

from app.domain.user import RefreshToken
from app.repositories.base import BaseRepository


class RefreshTokenRepository(BaseRepository):
    def create(self, *, user_id: uuid.UUID, token_hash: str, expires_at: datetime,
               user_agent: str | None, ip_address: str | None) -> RefreshToken:
        record = RefreshToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
            user_agent=user_agent,
            ip_address=ip_address,
        )
        self.db.add(record)
        self.db.commit()
        return record

    def get_valid_by_hash(self, token_hash: str) -> RefreshToken | None:
        record = self.db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
        if record is None:
            return None
        if record.revoked:
            return None
        if record.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            return None
        return record

    def get_by_hash(self, token_hash: str) -> RefreshToken | None:
        """Unlike get_valid_by_hash, returns even revoked/expired rows —
        used by logout, which should succeed idempotently either way."""
        return self.db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()

    def revoke(self, record: RefreshToken) -> None:
        record.revoked = True
        self.db.commit()

    def revoke_all_for_user(self, user_id: uuid.UUID) -> None:
        self.db.query(RefreshToken).filter(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked.is_(False),
        ).update({RefreshToken.revoked: True}, synchronize_session=False)
        self.db.commit()
