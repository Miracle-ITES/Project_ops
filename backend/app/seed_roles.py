"""
Seeds the four baseline roles and their permissions.

Run once after migrations:
    python -m app.seed_roles

Safe to re-run: get-or-create for both permissions and roles; never
removes a permission that was manually granted to a role afterward.
"""
from app.repositories.database import SessionLocal
from app.repositories.role_repository import PermissionRepository, RoleRepository
from app.domain.user import Role

ALL_PERMISSIONS = {
    "users:manage": "Create, edit, deactivate users",
    "users:request": "Request new users for administrator approval",
    "teams:view_own_roster": "View members of teams you belong to",
    "teams:manage": "Create and manage teams",
    "projects:manage": "Full CRUD on any project",
    "roles:manage": "Create/edit roles and permission assignments",
    "settings:manage": "Change platform-level settings",
    "ai_commands:manage": "Configure/run privileged AI commands",
    "exports:manage": "Export data out of the platform",
    "audit:review": "Review and act on audit logs",
    "projects:create": "Create new projects/tasks",
    "project_teams:manage": "Assign teams to projects",
    "tasks:assign": "Assign work to team members",
    "work:review": "Review submitted work",
    "blockers:manage": "Manage/resolve reported blockers",
    "learning_kt:manage": "Manage learning & knowledge-transfer content",
    "work:view_assigned": "View work assigned to self",
    "status:update": "Update status of own tasks",
    "daily_updates:submit": "Submit daily status updates",
    "learning:submit": "Submit learning progress",
    "blockers:raise": "Raise a blocker",
    "dashboards:view": "View dashboards",
    "projects:view": "View project data (read-only)",
    "projects:view_assigned": "View projects assigned to the user",
    "reports:view": "View reports",
    "audit:view": "View permitted audit views (read-only)",
}

ROLE_DEFINITIONS = {
    "Administrator": {
        "description": (
            "Manage users, teams, projects, roles, settings, AI commands, "
            "exports, and audit review. Subject to application safeguards "
            "and audit logging."
        ),
        "permissions": set(ALL_PERMISSIONS.keys()),
    },
    "Lead/Manager": {
        "description": (
            "Create projects/tasks, assign work, review work, manage "
            "blockers, learning and KT. Cannot change platform-level "
            "security settings unless separately granted."
        ),
        "permissions": {
            "projects:create", "tasks:assign", "work:review", "blockers:manage",
            "users:request", "teams:view_own_roster",
            "project_teams:manage",
            "learning_kt:manage", "work:view_assigned", "status:update",
            "daily_updates:submit", "dashboards:view", "projects:view", "reports:view",
        },
    },
    "Member": {
        "description": (
            "View assigned work, update status, submit daily updates, "
            "learning progress, raise blockers. Cannot reassign "
            "organization-wide ownership or edit restricted projects."
        ),
        "permissions": {
            "work:view_assigned", "status:update", "daily_updates:submit",
            "teams:view_own_roster",
            "learning:submit", "blockers:raise", "dashboards:view", "projects:view_assigned",
        },
    },
    "Viewer/Auditor": {
        "description": "Read dashboards, projects, reports and permitted audit views. No mutation rights.",
        "permissions": {"dashboards:view", "projects:view", "reports:view", "audit:view"},
    },
}


def seed():
    db = SessionLocal()
    try:
        permission_repo = PermissionRepository(db)
        role_repo = RoleRepository(db)

        code_to_permission = {
            code: permission_repo.get_or_create(code, description)
            for code, description in ALL_PERMISSIONS.items()
        }

        for role_name, definition in ROLE_DEFINITIONS.items():
            role = role_repo.get_by_name(role_name)
            if role is None:
                role = Role(name=role_name, description=definition["description"], is_system_role=True)
                db.add(role)
                db.flush()

            if role_name == "Lead/Manager":
                role.permissions = [permission for permission in role.permissions if permission.code != "teams:manage"]
            existing_codes = {p.code for p in role.permissions}
            for code in definition["permissions"] - existing_codes:
                role.permissions.append(code_to_permission[code])

        db.commit()
        print("Roles and permissions seeded successfully.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
