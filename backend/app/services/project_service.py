import uuid
from datetime import date

from app.domain.project import Milestone, MilestoneStatus, Project, ProjectContributor, ProjectMaturity, ProjectPriority, ProjectTeam
from app.repositories.project_repository import ProjectRepository
from app.repositories.team_repository import TeamRepository
from app.repositories.user_repository import UserRepository


class ProjectError(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class ProjectService:
    def __init__(self, projects: ProjectRepository, users: UserRepository, teams: TeamRepository):
        self.projects = projects
        self.users = users
        self.teams = teams

    def create_project(
        self, *, name: str, description: str | None, owner_id: uuid.UUID,
        priority: ProjectPriority, maturity: ProjectMaturity,
    ) -> Project:
        if self.users.get_by_id(owner_id) is None:
            raise ProjectError("Owner user not found")
        return self.projects.create(
            name=name, description=description, owner_id=owner_id,
            priority=priority, maturity=maturity,
        )

    def list_projects(self) -> list[Project]:
        return self.projects.list_all()

    def get_project(self, project_id: uuid.UUID) -> Project:
        project = self.projects.get_by_id(project_id)
        if project is None:
            raise ProjectError("Project not found")
        return project

    def update_project(
        self, project_id: uuid.UUID, *, name: str | None = None, description: str | None = None,
        priority: ProjectPriority | None = None, maturity: ProjectMaturity | None = None,
    ) -> Project:
        project = self.get_project(project_id)
        return self.projects.update(project, name=name, description=description, priority=priority, maturity=maturity)

    def add_contributor(self, project_id: uuid.UUID, user_id: uuid.UUID) -> ProjectContributor:
        project = self.get_project(project_id)
        if self.users.get_by_id(user_id) is None:
            raise ProjectError("User not found")
        if user_id == project.owner_id:
            raise ProjectError("Owner is already implicitly a contributor")
        if self.projects.is_contributor(project_id, user_id):
            raise ProjectError("User is already a contributor on this project")
        return self.projects.add_contributor(project_id, user_id)

    def add_milestone(
        self, project_id: uuid.UUID, *, name: str, due_date: date | None,
        status: MilestoneStatus = MilestoneStatus.PENDING,
    ) -> Milestone:
        self.get_project(project_id)  # 404s if missing
        return self.projects.add_milestone(project_id, name=name, due_date=due_date, status=status)

    def add_team(self, project_id: uuid.UUID, team_id: uuid.UUID) -> ProjectTeam:
        self.get_project(project_id)
        if self.teams.get_by_id(team_id) is None:
            raise ProjectError("Team not found")
        if self.projects.is_team_assigned(project_id, team_id):
            raise ProjectError("Team is already assigned to this project")
        return self.projects.add_team(project_id, team_id)

    def remove_team(self, project_id: uuid.UUID, team_id: uuid.UUID) -> None:
        self.get_project(project_id)
        if not self.projects.remove_team(project_id, team_id):
            raise ProjectError("Team is not assigned to this project")
