"""
End-to-end smoke test for Phase 2 auth against a *running* backend.
Not a pytest unit test — this hits real HTTP endpoints, so start the
server first:

    uvicorn main:app --reload --port 8001

Then, with the DB migrated and roles seeded, create at least one test
user manually (there's no public registration endpoint yet — see the
"Not yet done" note), then run:

    python verify_phase2.py you@example.com yourpassword
"""
import sys

import requests

BASE_URL = "http://localhost:8001"


def main():
    if len(sys.argv) != 3:
        print("Usage: python verify_phase2.py <email> <password>")
        sys.exit(1)

    email, password = sys.argv[1], sys.argv[2]

    print("1. Health check...")
    r = requests.get(f"{BASE_URL}/health")
    assert r.status_code == 200, r.text
    print("   OK:", r.json())

    print("2. Login with WRONG password (expect 401, generic message)...")
    r = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": "wrong-password-xyz"})
    assert r.status_code == 401, r.text
    print("   OK:", r.json())

    print("3. Login with correct credentials...")
    r = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    tokens = r.json()
    assert "access_token" in tokens and "refresh_token" in tokens
    print("   OK: got access_token + refresh_token, expires_in =", tokens["expires_in"])

    access_token = tokens["access_token"]
    refresh_token = tokens["refresh_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    print("4. GET /auth/me with access token...")
    r = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    assert r.status_code == 200, r.text
    me = r.json()
    print(f"   OK: {me['email']} — role={me['role']['name']} — permissions={len(me['role']['permissions'])}")

    print("5. GET /auth/me with NO token (expect 401)...")
    r = requests.get(f"{BASE_URL}/auth/me")
    assert r.status_code in (401, 403), r.text
    print("   OK: rejected,", r.status_code)

    print("6. GET /auth/me with a garbage token (expect 401)...")
    r = requests.get(f"{BASE_URL}/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert r.status_code == 401, r.text
    print("   OK: rejected,", r.status_code)

    print("7. Refresh token...")
    r = requests.post(f"{BASE_URL}/auth/refresh", json={"refresh_token": refresh_token})
    assert r.status_code == 200, r.text
    new_tokens = r.json()
    print("   OK: got a new token pair")

    print("8. Re-using the OLD refresh token (expect 401 — rotation/reuse detection)...")
    r = requests.post(f"{BASE_URL}/auth/refresh", json={"refresh_token": refresh_token})
    assert r.status_code == 401, r.text
    print("   OK: old refresh token correctly rejected")

    print("9. Logout with the NEW refresh token...")
    r = requests.post(f"{BASE_URL}/auth/logout", json={"refresh_token": new_tokens["refresh_token"]})
    assert r.status_code == 204, r.text
    print("   OK: logged out")

    print("10. Refresh AGAIN with the now-revoked token (expect 401)...")
    r = requests.post(f"{BASE_URL}/auth/refresh", json={"refresh_token": new_tokens["refresh_token"]})
    assert r.status_code == 401, r.text
    print("   OK: revoked token rejected")

    print("\nAll Phase 2 auth checks passed.")


if __name__ == "__main__":
    main()
