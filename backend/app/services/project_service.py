import uuid
from datetime import date

from app.domain.project import Milestone, MilestoneStatus, Project, ProjectContributor, ProjectMaturity, ProjectPriority, ProjectTeam
from app.repositories.project_repository import ProjectRepository
from app.repositories.team_repository import TeamRepository
from app.repositories.user_repository import UserRepository
from app.domain.user import User


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

    @staticmethod
    def _permissions(user: User) -> set[str]:
        return {permission.code for permission in user.role.permissions}

    def list_projects(self, *, user: User, limit: int = 20, offset: int = 0) -> list[Project]:
        permissions = self._permissions(user)
        scope = "all" if "users:manage" in permissions or ("projects:view" in permissions and "projects:create" not in permissions) else "owned" if "projects:create" in permissions else "assigned" if "projects:view_assigned" in permissions else "none"
        return self.projects.list_visible(user_id=user.id, scope=scope, limit=limit, offset=offset)

    def get_project(self, project_id: uuid.UUID) -> Project:
        project = self.projects.get_by_id(project_id)
        if project is None:
            raise ProjectError("Project not found")
        return project

    def get_visible_project(self, project_id: uuid.UUID, user: User) -> Project:
        project = self.get_project(project_id)
        permissions = self._permissions(user)
        if "users:manage" in permissions or ("projects:view" in permissions and "projects:create" not in permissions):
            return project
        if "projects:create" in permissions and project.owner_id == user.id:
            return project
        if "projects:view_assigned" in permissions and self.projects.is_assigned_to_user(project_id, user.id):
            return project
        raise ProjectError("Project not found")

    def _require_project_manager(self, project: Project, user: User) -> None:
        permissions = self._permissions(user)
        if "users:manage" not in permissions and not ("projects:create" in permissions and project.owner_id == user.id):
            raise ProjectError("Not allowed to manage this project")

    def list_project_members(self, project_id: uuid.UUID, user: User) -> list[User]:
        project = self.get_project(project_id)
        self._require_project_manager(project, user)
        return self.projects.list_project_members(project_id)

    def is_project_member(self, project_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        return self.projects.is_project_member(project_id, user_id)

    def is_assigned_to_user(self, project_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        return self.projects.is_assigned_to_user(project_id, user_id)

    def update_project(
        self, project_id: uuid.UUID, *, name: str | None = None, description: str | None = None,
        priority: ProjectPriority | None = None, maturity: ProjectMaturity | None = None, user: User,
    ) -> Project:
        project = self.get_project(project_id)
        self._require_project_manager(project, user)
        return self.projects.update(project, name=name, description=description, priority=priority, maturity=maturity)

    def add_contributor(self, project_id: uuid.UUID, user_id: uuid.UUID, user: User) -> ProjectContributor:
        project = self.get_project(project_id)
        self._require_project_manager(project, user)
        if self.users.get_by_id(user_id) is None:
            raise ProjectError("User not found")
        if "users:manage" not in self._permissions(user) and not self.projects.is_project_team_member(project_id, user_id):
            raise ProjectError("User must belong to a team assigned to this project")
        if user_id == project.owner_id:
            raise ProjectError("Owner is already implicitly a contributor")
        if self.projects.is_contributor(project_id, user_id):
            raise ProjectError("User is already a contributor on this project")
        return self.projects.add_contributor(project_id, user_id)

    def add_milestone(
        self, project_id: uuid.UUID, *, name: str, due_date: date | None,
        status: MilestoneStatus = MilestoneStatus.PENDING, user: User,
    ) -> Milestone:
        project = self.get_project(project_id)
        self._require_project_manager(project, user)
        return self.projects.add_milestone(project_id, name=name, due_date=due_date, status=status)

    def add_team(self, project_id: uuid.UUID, team_id: uuid.UUID, user: User) -> ProjectTeam:
        project = self.get_project(project_id)
        self._require_project_manager(project, user)
        if self.teams.get_by_id(team_id) is None:
            raise ProjectError("Team not found")
        if self.projects.is_team_assigned(project_id, team_id):
            raise ProjectError("Team is already assigned to this project")
        return self.projects.add_team(project_id, team_id)

    def remove_team(self, project_id: uuid.UUID, team_id: uuid.UUID, user: User) -> None:
        project = self.get_project(project_id)
        self._require_project_manager(project, user)
        if not self.projects.remove_team(project_id, team_id):
            raise ProjectError("Team is not assigned to this project")
