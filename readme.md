# Project Ops

AI-powered Team & Project Operations platform for managing projects, tasks, blockers, team progress, and AI-assisted workflows.

## Tech Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend:** FastAPI, Python, SQLAlchemy, Alembic
- **Database:** PostgreSQL 16
- **Cache:** Redis 7
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
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8001
```

### 3. Run with Docker

```bash
docker compose -f infra/docker-compose.yml up --build
```

## Services

| Service    | URL                          |
|------------|-------------------------------|
| Frontend   | http://localhost:3001         |
| Backend    | http://localhost:8001         |
| API Docs   | http://localhost:8001/docs    |
| PostgreSQL | localhost:5433                |
| Redis      | localhost:6380                |

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

More project modules will be added in upcoming phases.
