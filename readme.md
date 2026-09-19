# Project Ops

AI-powered Team & Project Operations platform for managing projects, tasks, blockers, team progress, and AI-assisted workflows.

## Tech Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend:** FastAPI, Python, SQLAlchemy, Alembic
- **Database:** PostgreSQL 16
- **Cache:** Redis 7
- **Auth:** JWT (access + refresh), bcrypt password hashing, RBAC
- **Infrastructure:** Docker, Docker Compose
- **Testing:** Pytest

## Project Structure

```text
project-control-center/
├── backend/       # FastAPI backend
├── frontend/      # Next.js frontend
├── infra/         # Docker Compose configuration
├── .gitignore
└── README.md
```

## Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd project-control-center
```

### 2. Configure environment variables

Create `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/project_control_center
REDIS_URL=redis://localhost:6380/0
JWT_SECRET_KEY=<generate with: openssl rand -hex 32>
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8001
```

### 3. Run with Docker

```bash
docker compose -f infra/docker-compose.yml up --build
```

### 4. Run database migrations and seed roles

```bash
cd backend
alembic upgrade head
python -m app.seed_roles
```

## Services

| Service    | URL                        |
| ---------- | -------------------------- |
| Frontend   | http://localhost:3001      |
| Backend    | http://localhost:8001      |
| API Docs   | http://localhost:8001/docs |
| PostgreSQL | localhost:5433             |
| Redis      | localhost:6380             |

## Health Check

**Backend:**

```http
GET /health
```

**Response:**

```json
{
  "status": "ok"
}
```

## Authentication & Roles

| Endpoint        | Method | Description                           |
| --------------- | ------ | ------------------------------------- |
| `/auth/login`   | POST   | Exchange email/password for tokens    |
| `/auth/refresh` | POST   | Rotate a refresh token for a new pair |
| `/auth/logout`  | POST   | Revoke a refresh token                |
| `/auth/me`      | GET    | Get the current authenticated user    |

Four built-in roles, seeded via `python -m app.seed_roles`:

| Role           | Primary Capabilities                                                                       | Restrictions                                                            |
| -------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Administrator  | Manage users, teams, projects, roles, settings, AI commands, exports, audit review         | Subject to application safeguards and audit logging                     |
| Lead/Manager   | Create projects/tasks, assign work, review work, manage blockers, learning and KT          | Cannot change platform-level security settings unless granted           |
| Member         | View assigned work, update status, submit daily updates, learning progress, raise blockers | Cannot reassign organization-wide ownership or edit restricted projects |
| Viewer/Auditor | Read dashboards, projects, reports and permitted audit views                               | No mutation rights                                                      |

Route-level access control uses granular permission codes (e.g. `projects:create`, `roles:manage`) rather than hardcoded role checks — see `backend/app/api/deps.py`.

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

## Status

### Phase 1 — Initial Setup Complete

- [x] Frontend setup
- [x] Backend setup
- [x] Docker Compose
- [x] PostgreSQL & Redis infrastructure
- [x] Database configuration
- [x] Alembic setup
- [x] API health check
- [x] Frontend–Backend connection

### Phase 2 — Authentication & RBAC Complete

- [x] `users` / `roles` / `permissions` tables (+ `refresh_tokens`, `audit_logs`)
- [x] JWT login/refresh/logout with token rotation and revocation
- [x] Bcrypt password hashing
- [x] Redis-backed login rate limiting / lockout
- [x] Permission middleware (`require_permission`) protecting routes
- [x] Role/permission seed script (Administrator, Lead/Manager, Member, Viewer/Auditor)
- [x] Audit logging for login attempts and permission denials
      More project modules will be added in upcoming phases.
