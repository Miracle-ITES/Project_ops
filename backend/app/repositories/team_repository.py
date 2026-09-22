import uuid

from sqlalchemy.orm import joinedload

from app.domain.team import Team, TeamMembership
from app.domain.user import User
from app.repositories.base import BaseRepository


class TeamRepository(BaseRepository):
    def create(self, *, name: str, description: str | None) -> Team:
        team = Team(name=name, description=description)
        self.db.add(team)
        self.db.commit()
        self.db.refresh(team)
        return team

    def get_by_id(self, team_id: uuid.UUID) -> Team | None:
        return self.db.query(Team).filter(Team.id == team_id).first()

    def get_by_name(self, name: str) -> Team | None:
        return self.db.query(Team).filter(Team.name == name).first()

    def list_all(self) -> list[Team]:
        return self.db.query(Team).order_by(Team.name).all()

    def is_member(self, team_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        return (
            self.db.query(TeamMembership)
            .filter(TeamMembership.team_id == team_id, TeamMembership.user_id == user_id)
            .first()
            is not None
        )

    def add_member(self, team_id: uuid.UUID, user_id: uuid.UUID) -> TeamMembership:
        membership = TeamMembership(team_id=team_id, user_id=user_id)
        self.db.add(membership)
        self.db.commit()
        self.db.refresh(membership)
        return membership

    def remove_member(self, team_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        membership = (
            self.db.query(TeamMembership)
            .filter(TeamMembership.team_id == team_id, TeamMembership.user_id == user_id)
            .first()
        )
        if membership is None:
            return False
        self.db.delete(membership)
        self.db.commit()
        return True

    def get_roster(self, team_id: uuid.UUID) -> list[TeamMembership]:
        return (
            self.db.query(TeamMembership)
            .options(joinedload(TeamMembership.user).joinedload(User.role))
            .filter(TeamMembership.team_id == team_id)
            .order_by(TeamMembership.joined_at)
            .all()
        )
