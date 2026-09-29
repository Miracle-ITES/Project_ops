import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_project_service, require_any_permission, require_permission
from app.api.schemas.projects import (
    ContributorAddRequest,
    ContributorOut,
    MilestoneCreateRequest,
    MilestoneOut,
    ProjectCreateRequest,
    ProjectDetailOut,
    ProjectTeamAddRequest,
    ProjectTeamOut,
    ProjectListItemOut,
    ProjectUpdateRequest,
)
from app.domain.project import Project
from app.domain.user import User
from app.services.project_service import ProjectError, ProjectService

router = APIRouter(prefix="/projects", tags=["projects"])


def _to_detail(project: Project) -> ProjectDetailOut:
    return ProjectDetailOut(
        id=project.id, name=project.name, description=project.description,
        priority=project.priority, maturity=project.maturity,
        owner=project.owner,
        contributors=[
            ContributorOut(user_id=c.user.id, email=c.user.email, full_name=c.user.full_name)
            for c in project.contributors
        ],
        teams=[
            ProjectTeamOut(team_id=pt.team.id, name=pt.team.name, description=pt.team.description)
            for pt in project.teams
        ],
        milestones=[MilestoneOut.model_validate(m) for m in project.milestones],
        created_at=project.created_at, updated_at=project.updated_at,
    )


@router.post("", response_model=ProjectDetailOut, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreateRequest,
    project_service: ProjectService = Depends(get_project_service),
    user: User = Depends(require_permission("projects:create")),
):
    is_admin = "users:manage" in {permission.code for permission in user.role.permissions}
    owner_id = (payload.owner_id or user.id) if is_admin else user.id
    try:
        project = project_service.create_project(
            name=payload.name, description=payload.description, owner_id=owner_id,
            priority=payload.priority, maturity=payload.maturity,
        )
        return _to_detail(project_service.get_project(project.id))
    except ProjectError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message)


@router.get("", response_model=list[ProjectListItemOut])
def list_projects(
    page: int = 1,
    page_size: int = 20,
    project_service: ProjectService = Depends(get_project_service),
    user: User = Depends(require_any_permission("projects:view", "projects:view_assigned")),
):
    if page < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="page must be >= 1")
    if page_size < 1 or page_size > 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="page_size must be between 1 and 100")
    offset = (page - 1) * page_size
    return project_service.list_projects(user=user, limit=page_size, offset=offset)


@router.get("/{project_id}", response_model=ProjectDetailOut)
def get_project(
    project_id: uuid.UUID,
    project_service: ProjectService = Depends(get_project_service),
    user: User = Depends(require_any_permission("projects:view", "projects:view_assigned")),
):
    try:
        return _to_detail(project_service.get_visible_project(project_id, user))
    except ProjectError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)


@router.patch("/{project_id}", response_model=ProjectDetailOut)
def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdateRequest,
    project_service: ProjectService = Depends(get_project_service),
    user: User = Depends(require_permission("projects:create", revalidate_from_db=True)),
):
    try:
        project_service.update_project(
            project_id, name=payload.name, description=payload.description,
            priority=payload.priority, maturity=payload.maturity, user=user,
        )
        return _to_detail(project_service.get_project(project_id))
    except ProjectError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)


@router.post("/{project_id}/contributors", response_model=ProjectDetailOut, status_code=status.HTTP_201_CREATED)
def add_contributor(
    project_id: uuid.UUID,
    payload: ContributorAddRequest,
    project_service: ProjectService = Depends(get_project_service),
    user: User = Depends(require_permission("projects:create", revalidate_from_db=True)),
):
    try:
        project_service.add_contributor(project_id, payload.user_id, user)
        return _to_detail(project_service.get_project(project_id))
    except ProjectError as exc:
        code = status.HTTP_404_NOT_FOUND if "not found" in exc.message.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=exc.message)


@router.post("/{project_id}/milestones", response_model=ProjectDetailOut, status_code=status.HTTP_201_CREATED)
def add_milestone(
    project_id: uuid.UUID,
    payload: MilestoneCreateRequest,
    project_service: ProjectService = Depends(get_project_service),
    user: User = Depends(require_permission("projects:create", revalidate_from_db=True)),
):
    try:
        project_service.add_milestone(
            project_id, name=payload.name, due_date=payload.due_date, status=payload.status, user=user,
        )
        return _to_detail(project_service.get_project(project_id))
    except ProjectError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)


@router.post("/{project_id}/teams", response_model=ProjectDetailOut, status_code=status.HTTP_201_CREATED)
def add_team(
    project_id: uuid.UUID,
    payload: ProjectTeamAddRequest,
    project_service: ProjectService = Depends(get_project_service),
    user: User = Depends(require_permission("project_teams:manage", revalidate_from_db=True)),
):
    try:
        project_service.add_team(project_id, payload.team_id, user)
        return _to_detail(project_service.get_project(project_id))
    except ProjectError as exc:
        code = status.HTTP_404_NOT_FOUND if "not found" in exc.message.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=exc.message)


@router.delete("/{project_id}/teams/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_team(
    project_id: uuid.UUID,
    team_id: uuid.UUID,
    project_service: ProjectService = Depends(get_project_service),
    user: User = Depends(require_permission("project_teams:manage", revalidate_from_db=True)),
):
    try:
        project_service.remove_team(project_id, team_id, user)
    except ProjectError as exc:
        code = status.HTTP_404_NOT_FOUND if "not found" in exc.message.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=exc.message)
    return None


@router.get("/{project_id}/members", response_model=list[ContributorOut])
def list_project_members(
    project_id: uuid.UUID,
    project_service: ProjectService = Depends(get_project_service),
    user: User = Depends(require_permission("projects:create", revalidate_from_db=True)),
):
    try:
        return [
            ContributorOut(user_id=member.id, email=member.email, full_name=member.full_name)
            for member in project_service.list_project_members(project_id, user)
        ]
    except ProjectError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.message)
