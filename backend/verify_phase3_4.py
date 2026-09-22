"""
End-to-end smoke test for Phase 3 & 4 against a *running* backend.
Requires an existing Administrator user (create one first if you haven't:
see app/create_test_user.py). This script itself creates a second user
(a Lead/Manager) via the admin API, so you don't need to pre-create one.

Usage:
    uvicorn app.main:app --reload --port 8001   # in one terminal
    python verify_phase3_4.py admin@example.com adminpassword
"""
import sys
import uuid

import requests

BASE_URL = "http://localhost:8001"


def login(email, password):
    r = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def main():
    if len(sys.argv) != 3:
        print("Usage: python verify_phase3_4.py <admin_email> <admin_password>")
        sys.exit(1)

    admin_email, admin_password = sys.argv[1], sys.argv[2]

    print("1. Login as Administrator...")
    admin_token = login(admin_email, admin_password)
    print("   OK")

    # ---------------- Phase 3: Users & Teams ----------------

    lead_email = f"lead-{uuid.uuid4().hex[:8]}@example.com"
    lead_password = "testpassword123"

    print(f"2. Admin creates a Lead/Manager user ({lead_email})...")
    r = requests.post(
        f"{BASE_URL}/users",
        headers=auth_headers(admin_token),
        json={"email": lead_email, "password": lead_password, "role_name": "Lead/Manager"},
    )
    assert r.status_code == 201, r.text
    lead_user_id = r.json()["id"]
    print("   OK: created user", lead_user_id)

    print("3. GET /users (expect the new user in the list)...")
    r = requests.get(f"{BASE_URL}/users", headers=auth_headers(admin_token))
    assert r.status_code == 200, r.text
    assert any(u["id"] == lead_user_id for u in r.json())
    print("   OK: found in list")

    print("4. A non-admin CANNOT create a user (expect 403)...")
    lead_token = login(lead_email, lead_password)
    r = requests.post(
        f"{BASE_URL}/users",
        headers=auth_headers(lead_token),
        json={"email": "shouldfail@example.com", "password": "whatever123", "role_name": "Member"},
    )
    assert r.status_code == 403, r.text
    print("   OK: correctly rejected,", r.status_code)

    team_name = f"Team {uuid.uuid4().hex[:6]}"
    print(f"5. Admin creates a team ({team_name})...")
    r = requests.post(f"{BASE_URL}/teams", headers=auth_headers(admin_token), json={"name": team_name})
    assert r.status_code == 201, r.text
    team_id = r.json()["id"]
    print("   OK: created team", team_id)

    print("6. Admin adds the Lead/Manager to the team...")
    r = requests.post(
        f"{BASE_URL}/teams/{team_id}/members", headers=auth_headers(admin_token), json={"user_id": lead_user_id}
    )
    assert r.status_code == 201, r.text
    print("   OK")

    print("7. Admin views the team roster (expect the new member)...")
    r = requests.get(f"{BASE_URL}/teams/{team_id}/roster", headers=auth_headers(admin_token))
    assert r.status_code == 200, r.text
    roster = r.json()
    assert any(m["user_id"] == lead_user_id for m in roster["members"]), roster
    print("   OK: roster shows", len(roster["members"]), "member(s)")

    # ---------------- Phase 4: Projects ----------------

    project_name = f"Project {uuid.uuid4().hex[:6]}"
    print(f"8. Lead/Manager creates a project ({project_name})...")
    r = requests.post(
        f"{BASE_URL}/projects",
        headers=auth_headers(lead_token),
        json={"name": project_name, "priority": "high", "maturity": "planning"},
    )
    assert r.status_code == 201, r.text
    project_id = r.json()["id"]
    print("   OK: created project", project_id)

    print("9. GET /projects (expect it in the list)...")
    r = requests.get(f"{BASE_URL}/projects", headers=auth_headers(lead_token))
    assert r.status_code == 200, r.text
    assert any(p["id"] == project_id for p in r.json())
    print("   OK: found in list")

    print("10. GET /projects/{id} (detail page data)...")
    r = requests.get(f"{BASE_URL}/projects/{project_id}", headers=auth_headers(lead_token))
    assert r.status_code == 200, r.text
    detail = r.json()
    assert detail["name"] == project_name
    assert detail["priority"] == "high"
    print("   OK: detail matches")

    print("11. Lead/Manager adds a milestone...")
    r = requests.post(
        f"{BASE_URL}/projects/{project_id}/milestones",
        headers=auth_headers(lead_token),
        json={"name": "Kickoff"},
    )
    assert r.status_code == 201, r.text
    assert len(r.json()["milestones"]) == 1
    print("   OK")

    print("12. A Member-permission user CANNOT create a project (expect 403)...")
    # Reuses the admin-created-user flow to spin up a throwaway Member.
    member_email = f"member-{uuid.uuid4().hex[:8]}@example.com"
    requests.post(
        f"{BASE_URL}/users",
        headers=auth_headers(admin_token),
        json={"email": member_email, "password": "testpassword123", "role_name": "Member"},
    )
    member_token = login(member_email, "testpassword123")
    r = requests.post(
        f"{BASE_URL}/projects",
        headers=auth_headers(member_token),
        json={"name": "Should not be created", "priority": "low", "maturity": "planning"},
    )
    assert r.status_code == 403, r.text
    print("   OK: correctly rejected,", r.status_code)

    print("\nAll Phase 3 & 4 checks passed.")


if __name__ == "__main__":
    main()
