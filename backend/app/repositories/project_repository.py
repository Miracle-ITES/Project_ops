import uuid
from datetime import date, datetime

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import joinedload, selectinload

from app.domain.project import Milestone, MilestoneStatus, Project, ProjectContributor, ProjectMaturity, ProjectPriority, ProjectTeam
from app.domain.team import TeamMembership
from app.domain.user import User
from app.repositories.base import BaseRepository


class ProjectRepository(BaseRepository):
    def create(
        self, *, name: str, description: str | None, owner_id: uuid.UUID,
        priority: ProjectPriority, maturity: ProjectMaturity,
    ) -> Project:
        project = Project(
            name=name, description=description, owner_id=owner_id,
            priority=priority, maturity=maturity,
        )
        self.db.add(project)
        self.db.commit()
        self.db.refresh(project)
        return project

    def get_by_id(self, project_id: uuid.UUID) -> Project | None:
        return (
            self.db.query(Project)
            .options(
                joinedload(Project.owner),
                joinedload(Project.contributors),
                joinedload(Project.milestones),
                joinedload(Project.teams).joinedload(ProjectTeam.team),
            )
            .filter(Project.id == project_id)
            .first()
        )

    def list_all(self, *, limit: int = 20, offset: int = 0) -> list[Project]:
        return (
            self.db.query(Project)
            .options(selectinload(Project.owner))
            .order_by(Project.created_at.desc(), Project.id)
            .limit(limit)
            .offset(offset)
            .all()
        )

    def list_visible(self, *, user_id: uuid.UUID, scope: str, limit: int, offset: int) -> list[Project]:
        query = self.db.query(Project).options(selectinload(Project.owner))
        if scope == "owned":
            query = query.filter(Project.owner_id == user_id)
        elif scope == "assigned":
            user_team_ids = select(TeamMembership.team_id).where(
                TeamMembership.user_id == user_id,
                TeamMembership.left_at.is_(None),
                or_(TeamMembership.end_date.is_(None), TeamMembership.end_date >= date.today()),
            )
            query = query.filter(or_(
                Project.owner_id == user_id,
                Project.contributors.any(and_(
                    ProjectContributor.user_id == user_id,
                    ProjectContributor.removed_at.is_(None),
                    or_(ProjectContributor.end_date.is_(None), ProjectContributor.end_date >= date.today()),
                )),
                Project.teams.any(ProjectTeam.team_id.in_(user_team_ids)),
            ))
        elif scope != "all":
            return []
        return query.order_by(Project.created_at.desc(), Project.id).limit(limit).offset(offset).all()

    def is_assigned_to_user(self, project_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        user_team_ids = select(TeamMembership.team_id).where(
            TeamMembership.user_id == user_id,
            TeamMembership.left_at.is_(None),
            or_(TeamMembership.end_date.is_(None), TeamMembership.end_date >= date.today()),
        )
        return self.db.query(Project.id).filter(
            Project.id == project_id,
            or_(
                Project.owner_id == user_id,
                Project.contributors.any(and_(
                    ProjectContributor.user_id == user_id,
                    ProjectContributor.removed_at.is_(None),
                    or_(ProjectContributor.end_date.is_(None), ProjectContributor.end_date >= date.today()),
                )),
                Project.teams.any(ProjectTeam.team_id.in_(user_team_ids)),
            ),
        ).first() is not None

    def is_project_team_member(self, project_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        return self.db.query(ProjectTeam.id).join(
            TeamMembership, TeamMembership.team_id == ProjectTeam.team_id
        ).filter(
            ProjectTeam.project_id == project_id,
            TeamMembership.user_id == user_id,
            TeamMembership.left_at.is_(None),
            or_(TeamMembership.end_date.is_(None), TeamMembership.end_date >= date.today()),
        ).first() is not None

    def list_project_members(self, project_id: uuid.UUID) -> list[User]:
        project = self.db.query(Project).filter(Project.id == project_id).first()
        if project is None:
            return []
        contributor_ids = select(ProjectContributor.user_id).where(
            ProjectContributor.project_id == project_id,
            ProjectContributor.removed_at.is_(None),
            or_(ProjectContributor.end_date.is_(None), ProjectContributor.end_date >= date.today()),
        )
        team_member_ids = select(TeamMembership.user_id).join(
            ProjectTeam, ProjectTeam.team_id == TeamMembership.team_id
        ).where(
            ProjectTeam.project_id == project_id,
            TeamMembership.left_at.is_(None),
            or_(TeamMembership.end_date.is_(None), TeamMembership.end_date >= date.today()),
        )
        return self.db.query(User).filter(
            User.is_active.is_(True),
            or_(User.id == project.owner_id, User.id.in_(contributor_ids), User.id.in_(team_member_ids)),
        ).order_by(User.full_name, User.email).all()

    def count_all(self) -> int:
        return self.db.query(Project).count()

    def update(self, project: Project, **fields) -> Project:
        for key, value in fields.items():
            if value is not None:
                setattr(project, key, value)
        self.db.commit()
        self.db.refresh(project)
        return project

    def add_contributor(self, project_id: uuid.UUID, user_id: uuid.UUID, end_date: date | None = None) -> ProjectContributor:
        contributor = ProjectContributor(project_id=project_id, user_id=user_id, end_date=end_date)
        self.db.add(contributor)
        self.db.commit()
        self.db.refresh(contributor)
        return contributor

    def is_contributor(self, project_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        return (
            self.db.query(ProjectContributor)
            .filter(
                ProjectContributor.project_id == project_id,
                ProjectContributor.user_id == user_id,
                ProjectContributor.removed_at.is_(None),
                or_(ProjectContributor.end_date.is_(None), ProjectContributor.end_date >= date.today()),
            )
            .first()
            is not None
        )

    def remove_contributor(self, project_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        contributor = (
            self.db.query(ProjectContributor)
            .filter(
                ProjectContributor.project_id == project_id,
                ProjectContributor.user_id == user_id,
                ProjectContributor.removed_at.is_(None),
                or_(ProjectContributor.end_date.is_(None), ProjectContributor.end_date >= date.today()),
            )
            .first()
        )
        if contributor is None:
            return False
        contributor.removed_at = datetime.utcnow()
        self.db.commit()
        return True

    def is_project_member(self, project_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        active_user = self.db.query(User.id).filter(User.id == user_id, User.is_active.is_(True)).first()
        if active_user is None:
            return False
        project = self.db.query(Project).filter(Project.id == project_id).first()
        if project is None:
            return False
        return project.owner_id == user_id or self.is_contributor(project_id, user_id) or self.is_project_team_member(project_id, user_id)

    def add_team(self, project_id: uuid.UUID, team_id: uuid.UUID) -> ProjectTeam:
        project_team = ProjectTeam(project_id=project_id, team_id=team_id)
        self.db.add(project_team)
        self.db.commit()
        self.db.refresh(project_team)
        return project_team

    def is_team_assigned(self, project_id: uuid.UUID, team_id: uuid.UUID) -> bool:
        return (
            self.db.query(ProjectTeam)
            .filter(ProjectTeam.project_id == project_id, ProjectTeam.team_id == team_id)
            .first()
            is not None
        )

    def remove_team(self, project_id: uuid.UUID, team_id: uuid.UUID) -> bool:
        project_team = (
            self.db.query(ProjectTeam)
            .filter(ProjectTeam.project_id == project_id, ProjectTeam.team_id == team_id)
            .first()
        )
        if project_team is None:
            return False
        self.db.delete(project_team)
        self.db.commit()
        return True

    def add_milestone(self, project_id: uuid.UUID, *, name: str, due_date) -> Milestone:
        milestone = Milestone(project_id=project_id, name=name, due_date=due_date)
        self.db.add(milestone)
        self.db.commit()
        self.db.refresh(milestone)
        return milestone

    def update_milestone_status(self, milestone: Milestone, status: MilestoneStatus) -> Milestone:
        milestone.status = status
        self.db.commit()
        self.db.refresh(milestone)
        return milestone
