import uuid
from datetime import date, datetime

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import joinedload

from app.domain.project import Blocker, BlockerStatus, Project, ProjectContributor, ProjectTeam
from app.domain.team import TeamMembership
from app.domain.user import User
from app.repositories.base import BaseRepository


class BlockerRepository(BaseRepository):
    def list_visible(self, user: User, *, offset: int, limit: int) -> tuple[list[Blocker], int]:
        permissions = {permission.code for permission in user.role.permissions}
        query = self.db.query(Blocker).options(
            joinedload(Blocker.project),
            joinedload(Blocker.raised_by),
            joinedload(Blocker.assignee),
        )

        # Match ProjectService.get_visible_project without querying once per blocker.
        if "users:manage" not in permissions and not (
            "projects:view" in permissions and "projects:create" not in permissions
        ):
            visible_projects = self.db.query(Project.id)
            if "projects:create" in permissions:
                visible_projects = visible_projects.filter(Project.owner_id == user.id)
            elif "projects:view_assigned" in permissions:
                user_team_ids = select(TeamMembership.team_id).where(
                    TeamMembership.user_id == user.id,
                    TeamMembership.left_at.is_(None),
                    or_(TeamMembership.end_date.is_(None), TeamMembership.end_date >= date.today()),
                )
                visible_projects = visible_projects.filter(or_(
                    Project.owner_id == user.id,
                    Project.contributors.any(and_(
                        ProjectContributor.user_id == user.id,
                        ProjectContributor.removed_at.is_(None),
                        or_(ProjectContributor.end_date.is_(None), ProjectContributor.end_date >= date.today()),
                    )),
                    Project.teams.any(ProjectTeam.team_id.in_(user_team_ids)),
                ))
            else:
                visible_projects = visible_projects.filter(False)
            query = query.filter(Blocker.project_id.in_(visible_projects))

        total = query.order_by(None).count()
        items = query.order_by(Blocker.created_at.desc(), Blocker.id.desc()).offset(offset).limit(limit).all()
        return items, total

    def create(self, *, project_id: uuid.UUID, title: str, description: str | None, raised_by_id: uuid.UUID, assignee_id: uuid.UUID | None = None) -> Blocker:
        blocker = Blocker(project_id=project_id, title=title, description=description, raised_by_id=raised_by_id, assignee_id=assignee_id)
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

    def update_assignee(self, blocker: Blocker, assignee_id: uuid.UUID | None) -> Blocker:
        blocker.assignee_id = assignee_id
        self.db.commit()
        return self.get_by_id(blocker.id)

    def get_by_id(self, blocker_id: uuid.UUID) -> Blocker | None:
        return (
            self.db.query(Blocker)
            .options(joinedload(Blocker.project), joinedload(Blocker.raised_by), joinedload(Blocker.assignee))
            .filter(Blocker.id == blocker_id)
            .first()
        )
