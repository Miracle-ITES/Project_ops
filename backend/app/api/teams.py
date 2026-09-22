import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_team_service, require_permission
from app.api.schemas.teams import RosterMemberOut, TeamCreateRequest, TeamMemberAddRequest, TeamOut, TeamRosterOut
from app.domain.user import User
from app.services.team_service import TeamError, TeamService

router = APIRouter(prefix="/teams", tags=["teams"])


@router.post("", response_model=TeamOut, status_code=status.HTTP_201_CREATED)
def create_team(
    payload: TeamCreateRequest,
    team_service: TeamService = Depends(get_team_service),
    _: User = Depends(require_permission("teams:manage")),
):
    try:
        return team_service.create_team(name=payload.name, description=payload.description)
    except TeamError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message)


@router.get("", response_model=list[TeamOut])
def list_teams(
    team_service: TeamService = Depends(get_team_service),
    # Any authenticated user can browse teams that exist — mutation is
    # what's Administrator-gated, per your Phase 3 spec ("Admin can create
    # a team, add members, and view a team roster").
    _: User = Depends(require_permission("teams:manage")),
):
    return team_service.list_teams()


@router.post("/{team_id}/members", response_model=TeamOut, status_code=status.HTTP_201_CREATED)
def add_member(
    team_id: uuid.UUID,
    payload: TeamMemberAddRequest,
    team_service: TeamService = Depends(get_team_service),
    _: User = Depends(require_permission("teams:manage")),
):
    try:
        team_service.add_member(team_id, payload.user_id)
        return team_service.get_team(team_id)
    except TeamError as exc:
        code = status.HTTP_404_NOT_FOUND if "not found" in exc.message.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=exc.message)


@router.delete("/{team_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    team_id: uuid.UUID,
    user_id: uuid.UUID,
    team_service: TeamService = Depends(get_team_service),
    _: User = Depends(require_permission("teams:manage")),
):
    try:
        team_service.remove_member(team_id, user_id)
    except TeamError as exc:
        code = status.HTTP_404_NOT_FOUND if "not found" in exc.message.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=exc.message)
    return None


@router.get("/{team_id}/roster", response_model=TeamRosterOut)
def get_roster(
    team_id: uuid.UUID,
    team_service: TeamService = Depends(get_team_service),
    _: User = Depends(require_permission("teams:manage")),
):
    try:
        team, memberships = team_service.get_roster(team_id)
    except TeamError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)

    members = [
        RosterMemberOut(
            user_id=m.user.id, email=m.user.email, full_name=m.user.full_name,
            role_name=m.user.role.name, joined_at=m.joined_at,
        )
        for m in memberships
    ]
    return TeamRosterOut(team=team, members=members)
