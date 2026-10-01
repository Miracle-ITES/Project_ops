import uuid

from app.domain.project import Blocker, BlockerStatus
from app.domain.user import User
from app.repositories.blocker_repository import BlockerRepository
from app.repositories.project_repository import ProjectRepository


class BlockerServiceError(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class BlockerService:
    def __init__(self, blockers: BlockerRepository, projects: ProjectRepository):
        self.blockers = blockers
        self.projects = projects

    def list_blockers(self, user: User, *, offset: int, limit: int) -> tuple[list[Blocker], int]:
        return self.blockers.list_visible(user, offset=offset, limit=limit)

    def create_blocker(self, *, project_id: uuid.UUID, title: str, description: str | None, raised_by_id: uuid.UUID, assignee_id: uuid.UUID | None = None, task_id: uuid.UUID | None = None, commit: bool = True) -> Blocker:
        if self.projects.get_by_id(project_id) is None:
            raise BlockerServiceError("Project not found")
        return self.blockers.create(
            project_id=project_id, title=title, description=description, raised_by_id=raised_by_id, assignee_id=assignee_id, task_id=task_id, commit=commit,
        )

    def update_assignee(self, blocker_id: uuid.UUID, assignee_id: uuid.UUID | None) -> Blocker:
        blocker = self.blockers.get_by_id(blocker_id)
        if blocker is None:
            raise BlockerServiceError("Ticket not found")
        return self.blockers.update_assignee(blocker, assignee_id)

    def update_status(self, blocker_id: uuid.UUID, status: BlockerStatus) -> Blocker:
        blocker = self.blockers.get_by_id(blocker_id)
        if blocker is None:
            raise BlockerServiceError("Ticket not found")
        return self.blockers.update_status(blocker, status)
