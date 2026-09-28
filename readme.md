# Project Ops

AI-powered team and project operations platform for managing projects, team progress, blockers, and AI-assisted workflows.

## Tech Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend:** FastAPI, Python, SQLAlchemy, Alembic
- **Database:** PostgreSQL 16
- **Cache:** Redis 7
- **Authentication:** JWT access and refresh tokens, bcrypt password hashing, RBAC
- **Infrastructure:** Docker and Docker Compose
- **Testing:** Pytest and the Phase 3/4 end-to-end smoke test

## Project Structure

```text
project-control-center/
├── backend/       # FastAPI backend
├── frontend/      # Next.js frontend
├── infra/         # Docker Compose configuration
├── .gitignore
└── readme.md
```

## Setup

### 1. Configure backend environment

Create `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/project_control_center
REDIS_URL=redis://localhost:6380/0
JWT_SECRET_KEY=<generate with: openssl rand -hex 32>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
ENVIRONMENT=development

# Required for administrator email invitations
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USERNAME=notifications@your-domain.com
SMTP_PASSWORD=<smtp-password>
SMTP_FROM=notifications@your-domain.com
SMTP_USE_TLS=true
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8001
```

### 2. Start the services

```bash
docker compose -f infra/docker-compose.yml up --build
```

### 3. Apply migrations and seed roles

From `backend/`:

```bash
alembic upgrade head
python -m app.seed_roles
```

Create an initial administrator after seeding, using `backend/app/create_test_user.py`.

To reset the local database and start from an empty PostgreSQL volume:

```bash
docker compose -f infra/docker-compose.yml down -v
docker compose -f infra/docker-compose.yml up -d
cd backend
alembic upgrade head
python -m app.seed_roles
```

## Services

| Service           | URL                        |
| ----------------- | -------------------------- |
| Frontend          | http://localhost:3001      |
| Backend           | http://localhost:8001      |
| API documentation | http://localhost:8001/docs |
| PostgreSQL        | localhost:5433             |
| Redis             | localhost:6380             |

## Frontend Pages

The frontend currently includes:

| Route                    | Description                                                     |
| ------------------------ | --------------------------------------------------------------- |
| `/login`                 | Sign in and restore a session                                   |
| `/dashboard`             | Project health and operational overview                         |
| `/users`                 | User requests, administrator approvals, and access management   |
| `/users/{user_id}`       | User profile and administrator access management                |
| `/profile`               | Signed-in user's company profile                                |
| `/teams`                 | Team directory; Leads can view, Administrators can manage       |
| `/teams/{team_id}`       | Team roster; membership changes are Administrator-only          |
| `/projects`              | Project directory and project creation                          |
| `/projects/{project_id}` | Project health and priority updates, team/contributor assignment, and milestones |
| `/blockers`              | Raise and resolve project blockers                              |
| `/activity`              | Recent authentication and administrative activity               |
| `/tasks`                 | Project-linked Kanban board with task assignment and status updates |
| `/updates`               | Daily updates and dated KT/Learning session tracking            |

## Health Check

```http
GET /health
```

```json
{
  "status": "ok"
}
```

## Authentication and RBAC

Authentication endpoints:

| Method | Endpoint        | Description                                 |
| ------ | --------------- | ------------------------------------------- |
| POST   | `/auth/login`   | Exchange email and password for tokens      |
| POST   | `/auth/refresh` | Rotate a refresh token for a new token pair |
| POST   | `/auth/logout`  | Revoke a refresh token                      |
| GET    | `/auth/me`      | Get the current authenticated user          |

Inactive users with valid credentials receive `Access denied by administrator`. Incorrect credentials continue to use the generic login error.

The application uses granular permission codes through `require_permission`, rather than hardcoded role checks. Every seeded role has `dashboards:view`; dashboard KPI cards summarize current platform data across users, while the project health list remains scoped to projects visible to the signed-in user. Dashboard values refresh when the page regains focus and every 30 seconds while visible. Members with `projects:view_assigned` can open the Projects section and see projects where they are listed as a contributor or belong to an assigned project team.

| Role           | Capabilities                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------------- |
| Administrator  | Manage users, teams, projects, roles, and all seeded permissions                                                |
| Lead/Manager   | Create/manage teams, add existing users, request new users for admin approval, assign work, and manage projects |
| Member         | View assigned work and project data where permitted, plus the roster of their own teams; cannot create projects |
| Viewer/Auditor | Read-only dashboard, project, report, and audit access                                                          |

Roles and permissions are defined in `backend/app/seed_roles.py`. The seed command is safe to rerun and preserves manually granted permissions.

## Phase 3: Users and Teams

Phase 3 adds users, teams, memberships, roster views, and administrator-approved invitation requests. Team browsing is available to users with `projects:view`, `project_teams:manage`, or `teams:manage`; Lead/Manager and Administrator roles can manage teams and memberships.

### Users

| Method | Endpoint                       | Description                                                     |
| ------ | ------------------------------ | --------------------------------------------------------------- |
| POST   | `/users`                       | Administrator-only email invitation with role and optional name |
| POST   | `/users/requests`              | Lead/Manager request for an administrator-approved invitation   |
| GET    | `/users/requests`              | Administrator list of invitation requests                       |
| GET    | `/users/requests/mine`         | Requester’s invitation history                                  |
| POST   | `/users/requests/{id}/approve` | Administrator approval; creates account and sends email         |
| POST   | `/users/requests/{id}/reject`  | Administrator rejection                                         |
| GET    | `/users`                       | List users and their roles and permissions                      |
| GET    | `/users/assignable`            | List users assignable to teams or projects                      |
| GET    | `/users/{user_id}`             | Get one user                                                    |
| PATCH  | `/users/me/profile`            | Complete the signed-in user's first-login profile               |
| PATCH  | `/users/{user_id}/profile`     | Administrator updates any user's profile                        |
| PATCH  | `/users/{user_id}/role`        | Change a user's role                                            |
| PATCH  | `/users/{user_id}/active`      | Activate or deactivate a user                                   |

Example request:

```json
{
  "email": "lead@example.com",
  "role_name": "Lead/Manager"
}
```

Administrator invitations generate a temporary password and send it by email. Lead/Manager requests never send email directly; the email is sent only after administrator approval. SMTP must be configured for invitations to succeed. Invited users must complete their company profile on first login; after submission, users cannot edit their own profile and only Administrators can change it.

### Teams

| Method | Endpoint                             | Description                                                       |
| ------ | ------------------------------------ | ----------------------------------------------------------------- |
| POST   | `/teams`                             | Create a team                                                     |
| GET    | `/teams`                             | List teams                                                        |
| GET    | `/teams/assignable`                  | List teams assignable to projects                                 |
| POST   | `/teams/{team_id}/members`           | Add a user to a team                                              |
| DELETE | `/teams/{team_id}/members/{user_id}` | Remove a user from a team                                         |
| GET    | `/teams/{team_id}/roster`            | View the team and member roster                                   |
| GET    | `/teams/mine/members`                | List members of the signed-in user's teams (Lead/Manager, Member) |

After adding or changing seeded permissions, rerun `python -m app.seed_roles` from `backend/` and refresh the affected user's session.

Team membership is stored in `team_memberships` and enforces one membership per team/user pair.

## Work Management

Tasks, daily updates, and learning/KT sessions use live PostgreSQL data. The Tasks page provides a Kanban board with drag-and-drop status transitions through `backlog`, `in_progress`, and `completed`.

| Method | Endpoint                  | Description                                                          |
| ------ | ------------------------- | -------------------------------------------------------------------- |
| GET    | `/tasks`                  | Paginated, searchable, status-filtered task list scoped to the caller |
| POST   | `/tasks`                  | Create a project-linked task with priority, due date, assignee, and reviewer |
| PATCH  | `/tasks/{task_id}`        | Update task details, assignment, or status                            |
| DELETE | `/tasks/{task_id}`        | Delete a task                                                        |
| GET    | `/daily-updates`          | Paginated updates; Members see their own, project viewers see all     |
| POST   | `/daily-updates`          | `daily_updates:submit`; submit or update your dated daily update      |
| GET    | `/learning`               | Paginated learning and KT session records                            |
| POST   | `/learning`               | Create a learning topic or KT session with session date              |
| PATCH  | `/learning/{item_id}`     | Track learning progress to completion                                |
| GET    | `/dashboard`              | Live KPI counts for projects, tasks, blockers, learning, and updates |
| GET    | `/exports/{resource}.csv` | CSV export for tasks, daily updates, or learning                     |

Significant work-management mutations write audit entries. Dashboard metrics and project health are queried from the database; no placeholder operational metrics are used.

Task assignment is limited to active members of the selected project (the owner, contributors, and members of assigned teams). Leads/Managers can create tasks and change assignments only on projects they own; Administrators can manage assignments across projects. Members see tasks assigned to them within projects assigned to them and can update only those tasks' status. Leads see tasks belonging to their owned projects. Project contributors, team assignments, metadata, and member rosters can be managed by that project's owner or an Administrator; a Lead cannot manage another owner's project.

## Phase 4: Projects

Phase 4 adds projects, contributors, milestones, and project-team assignment. Project priorities are `low`, `medium`, `high`, or `critical`. Project maturity values are `planning`, `active`, `at_risk`, `blocked`, or `completed`.

| Method | Endpoint                                 | Permission             | Description                                         |
| ------ | ---------------------------------------- | ---------------------- | --------------------------------------------------- |
| POST   | `/projects`                              | `projects:create`      | Create a project; `owner_id` defaults to the caller |
| GET    | `/projects`                              | `projects:view` or `projects:view_assigned` | List projects in the caller's visibility scope |
| GET    | `/projects/{project_id}`                 | `projects:view` or `projects:view_assigned` | Get visible project details, contributors, and milestones |
| PATCH  | `/projects/{project_id}`                 | `projects:create`      | Update project metadata, health/maturity, and priority |
| POST   | `/projects/{project_id}/contributors`    | `projects:create`      | Add a contributor                                   |
| POST   | `/projects/{project_id}/milestones`      | `projects:create`      | Add a milestone                                     |
| POST   | `/projects/{project_id}/teams`           | `project_teams:manage` | Assign a team to a project                          |
| DELETE | `/projects/{project_id}/teams/{team_id}` | `project_teams:manage` | Remove a team from a project                        |

The `project_teams:manage` permission is granted only to Administrator and Lead/Manager roles. Project team assignments are stored in `project_teams` and enforce one assignment per project/team pair.

## Blockers and Activity

Blockers are linked to projects and can be raised by users with `blockers:raise`. Users with `blockers:manage` can mark blockers as resolved. Blocker creation and status changes are written to the audit activity feed.

| Method | Endpoint                        | Permission        | Description                 |
| ------ | ------------------------------- | ----------------- | --------------------------- |
| GET    | `/blockers`                     | `projects:view`   | List project blockers       |
| POST   | `/blockers`                     | `blockers:raise`  | Raise a blocker on a visible project; optionally assign a project member |
| PATCH  | `/blockers/{blocker_id}/assignee` | `tasks:assign` | Assign or unassign a project member |
| PATCH  | `/blockers/{blocker_id}/status` | `blockers:manage` | Resolve or reopen a blocker |

Lead/Manager and Member roles can raise blockers; assignments can be changed by users with `tasks:assign` and must target a member of that project. Blocker lists follow the caller's project visibility scope. Run `alembic upgrade head` and `python -m app.seed_roles` after upgrading so the assignee column and permissions are applied.
| GET    | `/activity`                     | `audit:view`      | List recent audit activity  |

Example project request:

```json
{
  "name": "Platform rollout",
  "description": "Coordinate the next release",
  "priority": "high",
  "maturity": "planning"
}
```

The Phase 4 database migrations create `teams`, `team_memberships`, `projects`, `project_contributors`, `milestones`, and `project_teams`, plus the PostgreSQL enum types used by project priority, maturity, and milestone status.

## Verification

Run the backend tests from the repository root:

```bash
pytest backend/tests
```

For a local UI smoke test:

1. Log in as an Administrator.
2. Invite a user from `/users` and verify the email delivery.
3. Sign in as the invited user and complete the company profile.
4. Verify the profile is visible at `/profile` and editable only by the Administrator.
5. Verify Leads can browse `/teams` and assign teams on project details.
6. Raise a blocker and confirm it appears in `/activity`.

## Testing

```bash
cd backend
pytest
```

## Database Migrations

```bash
cd backend
alembic upgrade head
```

Current migration chain:

```text
279344241f97_initial
└── 0002_auth_rbac
  └── 0003_teams_projects
    └── 0004_project_teams
      └── 0005_invitations_blockers
        └── 0006_user_company_profile
          └── 0007_work_management
            └── 0008_invitation_requests
          └── 0009_indexes_for_lists
            └── 0010_task_project_scope
              └── 0011_blocker_assignment
```

## Implementation Status

### Phase 1: Initial Setup

- [x] Frontend and backend setup
- [x] Docker Compose infrastructure
- [x] PostgreSQL and Redis configuration
- [x] Alembic setup and health check
- [x] Frontend-to-backend connection

### Phase 2: Authentication and RBAC

- [x] Users, roles, permissions, refresh tokens, and audit logs
- [x] JWT login, refresh, logout, rotation, and revocation
- [x] Bcrypt password hashing
- [x] Redis-backed login rate limiting and lockout
- [x] Permission middleware and audit logging
- [x] Seeded Administrator, Lead/Manager, Member, and Viewer/Auditor roles

### Phase 3: Users and Teams

- [x] Administrator user management
- [x] Team creation and listing
- [x] Team membership management
- [x] Team roster retrieval
- [x] Frontend user administration and team roster pages
- [x] Administrator email invitations with generated temporary passwords
- [x] First-login company profile completion and administrator-only edits
- [x] Lead read-only team and roster access
- [x] Lead/Manager team and membership management
- [x] Lead/Manager invitation requests with administrator approval

### Phase 4: Projects

- [x] Project creation, listing, and detail retrieval
- [x] Project metadata updates
- [x] Project contributors
- [x] Project milestones
- [x] Project team assignment restricted to Administrator and Lead/Manager
- [x] PostgreSQL enum persistence aligned with API values
- [x] End-to-end smoke test passing

### Operational Workflows

- [x] Project blockers and resolution workflow
- [x] Activity feed for authentication, invitations, and blocker events
- [x] Inactive-account administrator denial message
- [x] Responsive personal and administrator profile sections
- [x] Live dashboard KPI queries and project health data
- [x] Kanban task workflow with drag-and-drop status changes
- [x] Project-linked tasks with project-member assignment controls
- [x] Project visibility scoped by role, ownership, and project assignment
- [x] Task list visibility limited to members' assigned tasks
- [x] Lead/Manager project membership and team management restricted to owned projects
- [x] Dated daily updates and learning/KT session tracking
- [x] Paginated work-management lists and CSV exports
- [x] Administrator-only access controls hidden for Administrator account details
