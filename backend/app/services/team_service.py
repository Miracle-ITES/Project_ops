import uuid

from app.domain.team import Team, TeamMembership
from app.repositories.team_repository import TeamRepository
from app.repositories.user_repository import UserRepository


class TeamError(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class TeamService:
    def __init__(self, teams: TeamRepository, users: UserRepository):
        self.teams = teams
        self.users = users

    def create_team(self, *, name: str, description: str | None) -> Team:
        if self.teams.get_by_name(name):
            raise TeamError(f"A team named '{name}' already exists")
        return self.teams.create(name=name, description=description)

    def list_teams(self) -> list[Team]:
        return self.teams.list_all()

    def get_team(self, team_id: uuid.UUID) -> Team:
        team = self.teams.get_by_id(team_id)
        if team is None:
            raise TeamError("Team not found")
        return team

    def add_member(self, team_id: uuid.UUID, user_id: uuid.UUID) -> TeamMembership:
        self.get_team(team_id)  # 404s if missing
        if self.users.get_by_id(user_id) is None:
            raise TeamError("User not found")
        if self.teams.is_member(team_id, user_id):
            raise TeamError("User is already a member of this team")
        return self.teams.add_member(team_id, user_id)

    def remove_member(self, team_id: uuid.UUID, user_id: uuid.UUID) -> None:
        self.get_team(team_id)
        if not self.teams.remove_member(team_id, user_id):
            raise TeamError("User is not a member of this team")

    def get_roster(self, team_id: uuid.UUID) -> tuple[Team, list[TeamMembership]]:
        team = self.get_team(team_id)
        return team, self.teams.get_roster(team_id)
