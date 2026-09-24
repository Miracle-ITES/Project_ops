import uuid
from datetime import datetime

from sqlalchemy.orm import joinedload

from app.domain.project import Blocker, BlockerStatus
from app.repositories.base import BaseRepository


class BlockerRepository(BaseRepository):
    def list_all(self) -> list[Blocker]:
        return (
            self.db.query(Blocker)
            .options(joinedload(Blocker.project), joinedload(Blocker.raised_by))
            .order_by(Blocker.created_at.desc())
            .all()
        )

    def create(self, *, project_id: uuid.UUID, title: str, description: str | None, raised_by_id: uuid.UUID) -> Blocker:
        blocker = Blocker(project_id=project_id, title=title, description=description, raised_by_id=raised_by_id)
        self.db.add(blocker)
        self.db.commit()
        self.db.refresh(blocker)
        return blocker

    def update_status(self, blocker: Blocker, status: BlockerStatus) -> Blocker:
        blocker.status = status
        blocker.resolved_at = datetime.utcnow() if status == BlockerStatus.RESOLVED else None
        self.db.commit()
        self.db.refresh(blocker)
        return blocker

    def get_by_id(self, blocker_id: uuid.UUID) -> Blocker | None:
        return (
            self.db.query(Blocker)
            .options(joinedload(Blocker.project), joinedload(Blocker.raised_by))
            .filter(Blocker.id == blocker_id)
            .first()
        )
