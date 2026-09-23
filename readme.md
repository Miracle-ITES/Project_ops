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

| Route                    | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| `/login`                 | Sign in and restore a session                                |
| `/dashboard`             | Project health and operational overview                      |
| `/users`                 | Administrator user provisioning and access management        |
| `/users/{user_id}`       | User details and role permissions                            |
| `/teams`                 | Team creation and team directory                             |
| `/teams/{team_id}`       | Team roster and member assignment                            |
| `/projects`              | Project directory and project creation                       |
| `/projects/{project_id}` | Project details, team/contributor assignment, and milestones |

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

The application uses granular permission codes through `require_permission`, rather than hardcoded role checks.

| Role           | Phase 3/4 capabilities                                                              |
| -------------- | ----------------------------------------------------------------------------------- |
| Administrator  | Manage users, teams, projects, roles, and all seeded permissions                    |
| Lead/Manager   | Create and view projects, add milestones and contributors, and manage assigned work |
| Member         | View assigned work and project data where permitted; cannot create projects         |
| Viewer/Auditor | Read-only dashboard, project, report, and audit access                              |

Roles and permissions are defined in `backend/app/seed_roles.py`. The seed command is safe to rerun and preserves manually granted permissions.

## Phase 3: Users and Teams

Phase 3 adds administrator-managed users, teams, memberships, and roster views. These routes require `users:manage` or `teams:manage`.

### Users

| Method | Endpoint                  | Description                                                      |
| ------ | ------------------------- | ---------------------------------------------------------------- |
| POST   | `/users`                  | Create a user with email, password, optional full name, and role |
| GET    | `/users`                  | List users and their roles and permissions                       |
| GET    | `/users/assignable`       | List users assignable to teams or projects                       |
| GET    | `/users/{user_id}`        | Get one user                                                     |
| PATCH  | `/users/{user_id}/role`   | Change a user's role                                             |
| PATCH  | `/users/{user_id}/active` | Activate or deactivate a user                                    |

Example request:

```json
{
  "email": "lead@example.com",
  "password": "testpassword123",
  "role_name": "Lead/Manager"
}
```

### Teams

| Method | Endpoint                             | Description                       |
| ------ | ------------------------------------ | --------------------------------- |
| POST   | `/teams`                             | Create a team                     |
| GET    | `/teams`                             | List teams                        |
| GET    | `/teams/assignable`                  | List teams assignable to projects |
| POST   | `/teams/{team_id}/members`           | Add a user to a team              |
| DELETE | `/teams/{team_id}/members/{user_id}` | Remove a user from a team         |
| GET    | `/teams/{team_id}/roster`            | View the team and member roster   |

Team membership is stored in `team_memberships` and enforces one membership per team/user pair.

## Phase 4: Projects

Phase 4 adds projects, contributors, milestones, and project-team assignment. Project priorities are `low`, `medium`, `high`, or `critical`. Project maturity values are `planning`, `active`, `at_risk`, `blocked`, or `completed`.

| Method | Endpoint                                 | Permission             | Description                                         |
| ------ | ---------------------------------------- | ---------------------- | --------------------------------------------------- |
| POST   | `/projects`                              | `projects:create`      | Create a project; `owner_id` defaults to the caller |
| GET    | `/projects`                              | `projects:view`        | List projects                                       |
| GET    | `/projects/{project_id}`                 | `projects:view`        | Get project details, contributors, and milestones   |
| PATCH  | `/projects/{project_id}`                 | `projects:create`      | Update project metadata                             |
| POST   | `/projects/{project_id}/contributors`    | `projects:create`      | Add a contributor                                   |
| POST   | `/projects/{project_id}/milestones`      | `projects:create`      | Add a milestone                                     |
| POST   | `/projects/{project_id}/teams`           | `project_teams:manage` | Assign a team to a project                          |
| DELETE | `/projects/{project_id}/teams/{team_id}` | `project_teams:manage` | Remove a team from a project                        |

The `project_teams:manage` permission is granted only to Administrator and Lead/Manager roles. Project team assignments are stored in `project_teams` and enforce one assignment per project/team pair.

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

Start the backend, then run the Phase 3/4 smoke test from `backend/` with an existing Administrator account:

```bash
uvicorn app.main:app --reload --port 8001
python verify_phase3_4.py admin@example.com adminpassword
```

The script verifies:

- Administrator login
- Administrator user creation and user listing
- Non-administrator user-creation denial
- Team creation, membership, and roster retrieval
- Lead/Manager project creation and listing
- Project detail retrieval and milestone creation
- Member project-creation denial

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

### Phase 4: Projects

- [x] Project creation, listing, and detail retrieval
- [x] Project metadata updates
- [x] Project contributors
- [x] Project milestones
- [x] Project team assignment restricted to Administrator and Lead/Manager
- [x] PostgreSQL enum persistence aligned with API values
- [x] End-to-end smoke test passing
