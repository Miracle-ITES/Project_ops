import uuid
from datetime import date

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

    def update_team_name(self, team_id: uuid.UUID, name: str) -> Team:
        team = self.get_team(team_id)
        existing = self.teams.get_by_name(name)
        if existing is not None and existing.id != team_id:
            raise TeamError(f"A team named '{name}' already exists")
        return self.teams.update_name(team, name)

    def delete_team(self, team_id: uuid.UUID) -> None:
        self.teams.delete(self.get_team(team_id))

    def list_teams(self) -> list[Team]:
        return self.teams.list_all()

    def list_user_teams(self, user_id: uuid.UUID) -> list[Team]:
        return self.teams.list_for_user(user_id)

    def is_member(self, team_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        return self.teams.is_member(team_id, user_id)

    def get_team(self, team_id: uuid.UUID) -> Team:
        team = self.teams.get_by_id(team_id)
        if team is None:
            raise TeamError("Team not found")
        return team

    def add_member(self, team_id: uuid.UUID, user_id: uuid.UUID, end_date: date | None = None) -> TeamMembership:
        self.get_team(team_id)  # 404s if missing
        if self.users.get_by_id(user_id) is None:
            raise TeamError("User not found")
        if end_date is not None and end_date < date.today():
            raise TeamError("Membership end date must be today or later")
        if self.teams.is_member(team_id, user_id):
            raise TeamError("User is already a member of this team")
        return self.teams.add_member(team_id, user_id, end_date)

    def remove_member(self, team_id: uuid.UUID, user_id: uuid.UUID) -> None:
        self.get_team(team_id)
        if not self.teams.remove_member(team_id, user_id):
            raise TeamError("User is not a member of this team")

    def get_roster(self, team_id: uuid.UUID) -> tuple[Team, list[TeamMembership]]:
        team = self.get_team(team_id)
        return team, self.teams.get_roster(team_id)

    def get_membership_history(self, team_id: uuid.UUID) -> list[TeamMembership]:
        self.get_team(team_id)
        return self.teams.get_membership_history(team_id)

    def count_teams_for_users(self, user_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
        return self.teams.count_teams_for_users(user_ids)

    def get_members_in_user_teams(self, user_id: uuid.UUID) -> list[TeamMembership]:
        return self.teams.get_members_in_user_teams(user_id)
