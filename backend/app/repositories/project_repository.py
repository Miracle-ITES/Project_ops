import uuid

from sqlalchemy.orm import joinedload

from app.domain.project import Milestone, Project, ProjectContributor, ProjectMaturity, ProjectPriority, ProjectTeam
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

    def list_all(self) -> list[Project]:
        return (
            self.db.query(Project)
            .options(joinedload(Project.owner))
            .order_by(Project.created_at.desc())
            .all()
        )

    def update(self, project: Project, **fields) -> Project:
        for key, value in fields.items():
            if value is not None:
                setattr(project, key, value)
        self.db.commit()
        self.db.refresh(project)
        return project

    def add_contributor(self, project_id: uuid.UUID, user_id: uuid.UUID) -> ProjectContributor:
        contributor = ProjectContributor(project_id=project_id, user_id=user_id)
        self.db.add(contributor)
        self.db.commit()
        self.db.refresh(contributor)
        return contributor

    def is_contributor(self, project_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        return (
            self.db.query(ProjectContributor)
            .filter(ProjectContributor.project_id == project_id, ProjectContributor.user_id == user_id)
            .first()
            is not None
        )

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

    def add_milestone(self, project_id: uuid.UUID, *, name: str, due_date, status) -> Milestone:
        milestone = Milestone(project_id=project_id, name=name, due_date=due_date, status=status)
        self.db.add(milestone)
        self.db.commit()
        self.db.refresh(milestone)
        return milestone
