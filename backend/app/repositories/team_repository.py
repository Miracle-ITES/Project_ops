import uuid
from datetime import date, datetime

from sqlalchemy import and_, func, or_
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

    def update_name(self, team: Team, name: str) -> Team:
        team.name = name
        self.db.commit()
        self.db.refresh(team)
        return team

    def delete(self, team: Team) -> None:
        self.db.delete(team)
        self.db.commit()

    def get_by_id(self, team_id: uuid.UUID) -> Team | None:
        return self.db.query(Team).filter(Team.id == team_id).first()

    def get_by_name(self, name: str) -> Team | None:
        return self.db.query(Team).filter(Team.name == name).first()

    def list_all(self) -> list[Team]:
        return self.db.query(Team).order_by(Team.name).all()

    def list_for_user(self, user_id: uuid.UUID) -> list[Team]:
        return (
            self.db.query(Team)
            .join(TeamMembership, TeamMembership.team_id == Team.id)
            .filter(self._active_membership_filter(), TeamMembership.user_id == user_id)
            .order_by(Team.name)
            .all()
        )

    @staticmethod
    def _active_membership_filter():
        return and_(
            TeamMembership.left_at.is_(None),
            or_(TeamMembership.end_date.is_(None), TeamMembership.end_date >= date.today()),
        )

    def is_member(self, team_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        return (
            self.db.query(TeamMembership)
            .filter(TeamMembership.team_id == team_id, TeamMembership.user_id == user_id, self._active_membership_filter())
            .first()
            is not None
        )

    def add_member(self, team_id: uuid.UUID, user_id: uuid.UUID, end_date: date | None = None) -> TeamMembership:
        membership = TeamMembership(team_id=team_id, user_id=user_id, end_date=end_date)
        self.db.add(membership)
        self.db.commit()
        self.db.refresh(membership)
        return membership

    def remove_member(self, team_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        membership = (
            self.db.query(TeamMembership)
            .filter(TeamMembership.team_id == team_id, TeamMembership.user_id == user_id, self._active_membership_filter())
            .first()
        )
        if membership is None:
            return False
        membership.left_at = datetime.utcnow()
        self.db.commit()
        return True

    def get_roster(self, team_id: uuid.UUID) -> list[TeamMembership]:
        return (
            self.db.query(TeamMembership)
            .options(joinedload(TeamMembership.user).joinedload(User.role))
            .filter(TeamMembership.team_id == team_id, self._active_membership_filter())
            .order_by(TeamMembership.joined_at)
            .all()
        )

    def get_membership_history(self, team_id: uuid.UUID) -> list[TeamMembership]:
        return (
            self.db.query(TeamMembership)
            .options(joinedload(TeamMembership.user).joinedload(User.role))
            .filter(
                TeamMembership.team_id == team_id,
                or_(TeamMembership.left_at.is_not(None), TeamMembership.end_date < date.today()),
            )
            .order_by(TeamMembership.left_at.desc().nullslast(), TeamMembership.end_date.desc().nullslast(), TeamMembership.joined_at.desc())
            .all()
        )

    def count_teams_for_users(self, user_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
        if not user_ids:
            return {}
        rows = (
            self.db.query(TeamMembership.user_id, func.count(TeamMembership.team_id))
            .filter(TeamMembership.user_id.in_(user_ids), self._active_membership_filter())
            .group_by(TeamMembership.user_id)
            .all()
        )
        return {user_id: count for user_id, count in rows}

    def get_members_in_user_teams(self, user_id: uuid.UUID) -> list[TeamMembership]:
        user_team_ids = (
            self.db.query(TeamMembership.team_id)
            .filter(TeamMembership.user_id == user_id, self._active_membership_filter())
            .subquery()
        )
        return (
            self.db.query(TeamMembership)
            .options(
                joinedload(TeamMembership.user).joinedload(User.role),
                joinedload(TeamMembership.team),
            )
            .filter(TeamMembership.team_id.in_(user_team_ids), self._active_membership_filter())
            .order_by(TeamMembership.joined_at.desc())
            .all()
        )
