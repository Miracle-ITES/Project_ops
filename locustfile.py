"""Locust scenarios for the Project Control Center API.

Run with a dedicated load-test account and database. User invitations that
send email are disabled unless LOCUST_ENABLE_EMAIL_INVITES=true.
"""
import os
import time
import uuid
from datetime import date, timedelta

from locust import HttpUser, between, task


BASE_URL = os.getenv("LOCUST_HOST", "http://localhost:8001")
DEFAULT_EMAIL = os.getenv("LOCUST_EMAIL", "admin@example.com")
DEFAULT_PASSWORD = os.getenv("LOCUST_PASSWORD", "YourPassword123!")
ENABLE_EMAIL_INVITES = os.getenv("LOCUST_ENABLE_EMAIL_INVITES", "false").lower() in {"1", "true", "yes"}
TEST_EMAIL_DOMAIN = os.getenv("LOCUST_TEST_EMAIL_DOMAIN", "example.com")


class ProjectControlCenterUser(HttpUser):  # pyright: ignore[reportGeneralTypeIssues]
    """Authenticated user that exercises read and write API traffic."""

    host = BASE_URL
    wait_time = between(1, 3)

    def on_start(self):
        self.client.headers.update({"Content-Type": "application/json"})
        self.login_failed = False
        self.access_token = None
        self.refresh_token = None
        self.permissions = set()
        self.user_id = None
        self.project_ids = []
        self.team_ids = []
        self.assignable_user_ids = []
        self.daily_update_offset = 0

        for attempt in range(1, 4):
            with self.client.post(
                "/auth/login",
                json={"email": DEFAULT_EMAIL, "password": DEFAULT_PASSWORD},
                name="POST /auth/login",
                catch_response=True,
            ) as response:
                if response.status_code == 200:
                    tokens = response.json()
                    self._set_tokens(tokens)
                    break
                if response.status_code == 429 and attempt < 3:
                    response.success()
                    time.sleep(10)
                    continue
                self.login_failed = True
                response.failure(f"Login failed ({response.status_code}): {response.text}")
                return

        self._load_identity_and_fixtures()

    def _set_tokens(self, tokens):
        self.access_token = tokens.get("access_token")
        self.refresh_token = tokens.get("refresh_token")
        if self.access_token:
            self.client.headers.update({"Authorization": f"Bearer {self.access_token}"})

    def _load_identity_and_fixtures(self):
        if self.login_failed:
            return
        response = self.client.get("/auth/me", name="GET /auth/me")
        if response.status_code == 200:
            identity = response.json()
            self.user_id = identity.get("id")
            self.permissions = set(identity.get("role", {}).get("permissions", []))

        fixtures = []
        if self._has("projects:view", "projects:view_assigned"):
            fixtures.append(("/projects", "project_ids", "GET /projects [load-test fixtures]"))
        if self._has("teams:manage", "project_teams:manage"):
            fixtures.append(("/teams/assignable", "team_ids", "GET /teams/assignable [load-test fixtures]"))
        elif self._has("projects:view"):
            fixtures.append(("/teams", "team_ids", "GET /teams [load-test fixtures]"))
        elif self._has("teams:view_own_roster"):
            fixtures.append(("/teams/mine", "team_ids", "GET /teams/mine [load-test fixtures]"))
        if self._has("users:manage", "teams:manage", "projects:create"):
            fixtures.append(("/users/assignable", "assignable_user_ids", "GET /users/assignable [load-test fixtures]"))
        for path, target, name in fixtures:
            response = self.client.get(path, name=name)
            if response.status_code == 200:
                rows = response.json()
                setattr(self, target, [row["id"] for row in rows if row.get("id")])

    def _has(self, *permissions):
        return any(permission in self.permissions for permission in permissions)

    def _post(self, path, payload, name, expected=(200, 201)):
        """Make a named write request and turn unexpected status into a Locust failure."""
        with self.client.post(path, json=payload, name=name, catch_response=True) as response:
            if response.status_code in expected:
                try:
                    return response.json() if response.content else {}
                except ValueError:
                    response.failure("Expected JSON response")
                    return None
            response.failure(f"Unexpected status {response.status_code}: {response.text[:300]}")
            return None

    def _new_project(self):
        if not self._has("projects:create"):
            return None
        project = self._post(
            "/projects",
            {"name": f"Load project {uuid.uuid4().hex[:12]}", "description": "Locust-generated project"},
            "POST /projects",
        )
        if project and project.get("id"):
            self.project_ids.append(project["id"])
            return project["id"]
        return None

    def _new_team(self):
        if not self._has("teams:manage"):
            return None
        team = self._post(
            "/teams",
            {"name": f"Load team {uuid.uuid4().hex[:12]}", "description": "Locust-generated team"},
            "POST /teams",
        )
        if team and team.get("id"):
            self.team_ids.append(team["id"])
            return team["id"]
        return None

    def _project_for_write(self):
        if self.project_ids:
            return self.project_ids[0]
        return self._new_project()

    @task(2)
    def health_check(self):
        if not self.login_failed:
            self.client.get("/health", name="GET /health")

    @task(3)
    def get_current_user(self):
        if not self.login_failed:
            self.client.get("/auth/me", name="GET /auth/me")

    @task(4)
    def list_projects(self):
        if not self.login_failed:
            self.client.get("/projects", name="GET /projects")

    @task(3)
    def list_teams(self):
        if self.login_failed:
            return
        path = "/teams" if self._has("projects:view", "teams:manage", "project_teams:manage") else "/teams/mine"
        self.client.get(path, name=f"GET {path}")

    @task(2)
    def list_users(self):
        if self.login_failed or not self._has("users:manage"):
            return
        self.client.get("/users", name="GET /users")

    @task(2)
    def list_tasks(self):
        if not self.login_failed:
            self.client.get("/tasks", name="GET /tasks")

    @task(1)
    def list_blockers(self):
        if not self.login_failed:
            self.client.get("/blockers", name="GET /blockers")

    @task(1)
    def refresh_session(self):
        if self.login_failed or not self.refresh_token:
            return
        tokens = self._post(
            "/auth/refresh",
            {"refresh_token": self.refresh_token},
            "POST /auth/refresh",
        )
        if tokens:
            self._set_tokens(tokens)

    @task(2)
    def create_project(self):
        if not self.login_failed:
            self._new_project()

    @task(2)
    def create_team(self):
        if not self.login_failed:
            self._new_team()

    @task(3)
    def create_task(self):
        if self.login_failed or not self._has("projects:create"):
            return
        project_id = self._project_for_write()
        if not project_id:
            return
        self._post(
            "/tasks",
            {
                "title": f"Load task {uuid.uuid4().hex[:12]}",
                "description": "Locust-generated task",
                "priority": "medium",
                "project_id": project_id,
            },
            "POST /tasks",
        )

    @task(2)
    def submit_daily_update(self):
        if self.login_failed or not self._has("daily_updates:submit"):
            return
        self.daily_update_offset += 1
        update_date = (date.today() - timedelta(days=self.daily_update_offset)).isoformat()
        self._post(
            "/daily-updates",
            {
                "update_date": update_date,
                "summary": f"Locust progress {uuid.uuid4().hex[:10]}",
                "accomplishments": "Generated during API load testing",
                "plans": "Continue load test",
                "blockers": None,
            },
            "POST /daily-updates",
        )

    @task(2)
    def create_learning_item(self):
        if self.login_failed or not self._has("projects:create"):
            return
        self._post(
            "/learning",
            {"topic": f"Load KT {uuid.uuid4().hex[:12]}", "notes": "Locust-generated learning item"},
            "POST /learning",
        )

    @task(2)
    def create_blocker(self):
        if self.login_failed or not self._has("blockers:raise", "blockers:manage"):
            return
        project_id = self._project_for_write()
        if not project_id:
            return
        self._post(
            "/blockers",
            {"project_id": project_id, "title": f"Load blocker {uuid.uuid4().hex[:12]}", "description": "Locust-generated blocker"},
            "POST /blockers",
        )

    @task(1)
    def add_project_milestone(self):
        if self.login_failed or not self._has("projects:create"):
            return
        project_id = self._project_for_write()
        if project_id:
            self._post(
                f"/projects/{project_id}/milestones",
                {"name": f"Load milestone {uuid.uuid4().hex[:10]}", "status": "pending"},
                "POST /projects/{project_id}/milestones",
            )

    @task(1)
    def add_project_contributor(self):
        if self.login_failed or not self._has("users:manage"):
            return
        candidates = [user_id for user_id in self.assignable_user_ids if user_id != self.user_id]
        if not candidates:
            return
        project_id = self._new_project()
        if project_id:
            self._post(
                f"/projects/{project_id}/contributors",
                {"user_id": candidates[0]},
                "POST /projects/{project_id}/contributors",
            )

    @task(1)
    def add_project_team(self):
        if self.login_failed or not self._has("project_teams:manage"):
            return
        project_id = self._new_project()
        team_id = self.team_ids[0] if self.team_ids else self._new_team()
        if project_id and team_id:
            self._post(
                f"/projects/{project_id}/teams",
                {"team_id": team_id},
                "POST /projects/{project_id}/teams",
            )

    @task(1)
    def add_team_member(self):
        if self.login_failed or not self._has("teams:manage"):
            return
        team_id = self._new_team()
        candidates = [user_id for user_id in self.assignable_user_ids if user_id != self.user_id]
        if team_id and candidates:
            self._post(
                f"/teams/{team_id}/members",
                {"user_id": candidates[0]},
                "POST /teams/{team_id}/members",
            )

    @task(1)
    def request_user_invitation(self):
        if self.login_failed or not self._has("users:request", "users:manage"):
            return
        self._post(
            "/users/requests",
            {"email": f"locust-{uuid.uuid4().hex}@{TEST_EMAIL_DOMAIN}", "full_name": "Locust Test User", "role_name": "Member"},
            "POST /users/requests",
        )

    @task(1)
    def create_user_with_email_invite(self):
        # This endpoint sends an invitation email; enable only on a controlled test mail setup.
        if self.login_failed or not ENABLE_EMAIL_INVITES or not self._has("users:manage"):
            return
        self._post(
            "/users",
            {"email": f"locust-{uuid.uuid4().hex}@{TEST_EMAIL_DOMAIN}", "full_name": "Locust Test User", "role_name": "Member"},
            "POST /users [email invite]",
        )

    @task(1)
    def reject_invitation_request(self):
        if self.login_failed or not self._has("users:manage"):
            return
        request = self._post(
            "/users/requests",
            {"email": f"locust-reject-{uuid.uuid4().hex}@{TEST_EMAIL_DOMAIN}", "full_name": "Locust Test User", "role_name": "Member"},
            "POST /users/requests [reject fixture]",
        )
        if request and request.get("id"):
            self._post(
                f"/users/requests/{request['id']}/reject",
                {"note": "Rejected by Locust load test"},
                "POST /users/requests/{request_id}/reject",
            )

    @task(1)
    def approve_invitation_request(self):
        # Approval provisions a real account and sends email, so it is opt-in.
        if self.login_failed or not ENABLE_EMAIL_INVITES or not self._has("users:manage"):
            return
        request = self._post(
            "/users/requests",
            {"email": f"locust-approve-{uuid.uuid4().hex}@{TEST_EMAIL_DOMAIN}", "full_name": "Locust Test User", "role_name": "Member"},
            "POST /users/requests [approval fixture]",
        )
        if request and request.get("id"):
            self._post(
                f"/users/requests/{request['id']}/approve",
                {"note": "Approved by Locust load test"},
                "POST /users/requests/{request_id}/approve [email invite]",
            )

    def on_stop(self):
        if self.refresh_token:
            self._post(
                "/auth/logout",
                {"refresh_token": self.refresh_token},
                "POST /auth/logout",
                expected=(200, 204),
            )
