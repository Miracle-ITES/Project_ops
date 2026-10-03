import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_team_service, require_any_permission, require_permission
from app.api.schemas.teams import MyTeamMemberOut, RosterMemberOut, TeamCreateRequest, TeamMemberAddRequest, TeamMembershipHistoryOut, TeamOut, TeamRosterOut, TeamUpdateRequest
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


@router.patch("/{team_id}", response_model=TeamOut)
def update_team(
    team_id: uuid.UUID,
    payload: TeamUpdateRequest,
    team_service: TeamService = Depends(get_team_service),
    _: User = Depends(require_permission("users:manage", revalidate_from_db=True)),
):
    try:
        name = payload.name.strip()
        if not name:
            raise TeamError("Team name cannot be empty")
        return team_service.update_team_name(team_id, name)
    except TeamError as exc:
        code = status.HTTP_404_NOT_FOUND if exc.message == "Team not found" else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=exc.message)


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team(
    team_id: uuid.UUID,
    team_service: TeamService = Depends(get_team_service),
    _: User = Depends(require_permission("users:manage", revalidate_from_db=True)),
):
    try:
        team_service.delete_team(team_id)
    except TeamError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)
    return None


@router.get("", response_model=list[TeamOut])
def list_teams(
    team_service: TeamService = Depends(get_team_service),
    _: User = Depends(require_any_permission("teams:manage", "project_teams:manage", "projects:view")),
):
    return team_service.list_teams()


@router.get("/mine", response_model=list[TeamOut])
def list_my_teams(
    team_service: TeamService = Depends(get_team_service),
    current_user: User = Depends(require_permission("teams:view_own_roster")),
):
    return team_service.list_user_teams(current_user.id)


@router.get("/assignable", response_model=list[TeamOut])
def list_assignable_teams(
    team_service: TeamService = Depends(get_team_service),
    _: User = Depends(require_any_permission("teams:manage", "project_teams:manage")),
):
    return team_service.list_teams()


@router.get("/mine/members", response_model=list[MyTeamMemberOut])
def list_my_team_members(
    team_service: TeamService = Depends(get_team_service),
    current_user: User = Depends(require_permission("teams:view_own_roster")),
):
    memberships = team_service.get_members_in_user_teams(current_user.id)
    members_by_id = {}
    for membership in memberships:
        member = members_by_id.setdefault(membership.user_id, {
            "user_id": membership.user.id,
            "email": membership.user.email,
            "full_name": membership.user.full_name,
            "role_name": membership.user.role.name,
            "is_active": membership.user.is_active,
            "team_names": set(),
        })
        member["team_names"].add(membership.team.name)
    return [
        MyTeamMemberOut(**{**member, "team_names": sorted(member["team_names"])})
        for member in members_by_id.values()
    ]


@router.post("/{team_id}/members", response_model=TeamOut, status_code=status.HTTP_201_CREATED)
def add_member(
    team_id: uuid.UUID,
    payload: TeamMemberAddRequest,
    team_service: TeamService = Depends(get_team_service),
    _: User = Depends(require_permission("teams:manage")),
):
    try:
        team_service.add_member(team_id, payload.user_id, payload.end_date)
        return team_service.get_team(team_id)
    except TeamError as exc:
        code = status.HTTP_404_NOT_FOUND if "not found" in exc.message.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=exc.message)


@router.get("/{team_id}/history", response_model=list[TeamMembershipHistoryOut])
def get_membership_history(
    team_id: uuid.UUID,
    team_service: TeamService = Depends(get_team_service),
    current_user: User = Depends(require_any_permission("teams:manage", "project_teams:manage", "projects:view", "teams:view_own_roster")),
):
    try:
        permissions = set(getattr(current_user, "_token_permissions", []))
        if not permissions.intersection({"teams:manage", "project_teams:manage", "projects:view"}) and not team_service.is_member(team_id, current_user.id):
            raise TeamError("Team not found")
        return [
            TeamMembershipHistoryOut(
                user_id=membership.user.id,
                email=membership.user.email,
                full_name=membership.user.full_name,
                role_name=membership.user.role.name,
                joined_at=membership.joined_at,
                end_date=membership.end_date,
                left_at=membership.left_at,
            )
            for membership in team_service.get_membership_history(team_id)
        ]
    except TeamError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)


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
    current_user: User = Depends(require_any_permission("teams:manage", "project_teams:manage", "projects:view", "teams:view_own_roster")),
):
    try:
        permissions = set(getattr(current_user, "_token_permissions", []))
        if not permissions.intersection({"teams:manage", "project_teams:manage", "projects:view"}) and not team_service.is_member(team_id, current_user.id):
            raise TeamError("Team not found")
        team, memberships = team_service.get_roster(team_id)
    except TeamError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)

    team_counts = team_service.count_teams_for_users([m.user.id for m in memberships])
    members = [
        RosterMemberOut(
            user_id=m.user.id, email=m.user.email, full_name=m.user.full_name,
            role_name=m.user.role.name, joined_at=m.joined_at, end_date=m.end_date,
            team_count=team_counts.get(m.user.id, 0),
        )
        for m in memberships
    ]
    return TeamRosterOut(team=team, members=members)
