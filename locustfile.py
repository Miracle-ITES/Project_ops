import os
import time

from locust import HttpUser, between, task


BASE_URL = os.getenv("LOCUST_HOST", "http://localhost:8001")
DEFAULT_EMAIL = os.getenv("LOCUST_EMAIL", "admin@example.com")
DEFAULT_PASSWORD = os.getenv("LOCUST_PASSWORD", "YourPassword123!")


class ProjectControlCenterUser(HttpUser):  # pyright: ignore[reportGeneralTypeIssues]
    host = BASE_URL
    wait_time = between(1, 3)
    login_failed = False

    def on_start(self):
        self.client.headers.update({"Content-Type": "application/json"})

        for attempt in range(1, 4):
            response = self.client.post(
                "/auth/login",
                json={"email": DEFAULT_EMAIL, "password": DEFAULT_PASSWORD},
                name="POST /auth/login",
                catch_response=True,
            )

            if response.status_code == 200:
                token = response.json().get("access_token")
                if token:
                    self.client.headers.update({"Authorization": f"Bearer {token}"})
                    return
                response.failure("Login response did not include an access token")
                return

            if response.status_code == 429:
                if attempt < 3:
                    time.sleep(10)
                    continue
                self.login_failed = True
                response.failure(f"Login rate limited after {attempt} attempts: {response.text}")
                return

            if response.status_code == 401:
                self.login_failed = True
                response.failure(f"Authentication failed for {DEFAULT_EMAIL}: {response.text}")
                return

            self.login_failed = True
            response.failure(f"Unexpected login status {response.status_code}: {response.text}")
            return

    @task(2)
    def health_check(self):
        if self.login_failed:
            return
        self.client.get("/health", name="GET /health")

    @task(3)
    def get_current_user(self):
        if self.login_failed:
            return
        self.client.get("/auth/me", name="GET /auth/me")

    @task(4)
    def list_projects(self):
        if self.login_failed:
            return
        self.client.get("/projects", name="GET /projects")

    @task(3)
    def list_teams(self):
        if self.login_failed:
            return
        self.client.get("/teams", name="GET /teams")

    @task(2)
    def list_users(self):
        if self.login_failed:
            return
        self.client.get("/users", name="GET /users")

    @task(1)
    def list_tasks(self):
        if self.login_failed:
            return
        self.client.get("/tasks", name="GET /tasks")

    @task(1)
    def list_blockers(self):
        if self.login_failed:
            return
        self.client.get("/blockers", name="GET /blockers")
