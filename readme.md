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
Setup
1. Clone
git clone <repository-url>
cd project-control-center
2. Environment Variables

Create backend/.env:

DATABASE_URL=postgresql://postgres:postgres@localhost:5433/project_control_center

Create frontend/.env.local:

NEXT_PUBLIC_API_URL=http://localhost:8001
3. Run with Docker
docker compose -f infra/docker-compose.yml up --build
Services
Service	URL
Frontend	http://localhost:3001
Backend	http://localhost:8001
API Docs	http://localhost:8001/docs
PostgreSQL	localhost:5433
Redis	localhost:6380
Health Check

Backend:

GET /health

Response:

{
  "status": "ok"
}
Testing
cd backend
pytest
Database Migrations
cd backend
alembic upgrade head
Status

Phase 1 — Initial Setup Complete

Frontend setup
Backend setup
Docker Compose
PostgreSQL & Redis infrastructure
Database configuration
Alembic setup
API health check
Frontend–Backend connection

More project modules will be added in upcoming phases.

