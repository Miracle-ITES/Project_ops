import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.base import Base
from app.domain.user import User


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    memberships: Mapped[list["TeamMembership"]] = relationship(back_populates="team", cascade="all, delete-orphan")


class TeamMembership(Base):
    """Join row between User and Team — kept as its own entity (not a bare
    association table) since it carries its own membership timeline and is
    queried directly for roster and history listings."""

    __tablename__ = "team_memberships"
    __table_args__ = (Index("ix_team_memberships_team_joined", "team_id", "joined_at"),)

    id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    left_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    team: Mapped["Team"] = relationship(back_populates="memberships")
    user: Mapped["User"] = relationship()
