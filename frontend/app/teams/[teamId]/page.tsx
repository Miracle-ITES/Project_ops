"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { addMember, getRoster, removeMember } from "@/lib/teams-api";
import { listAssignableUsers } from "@/lib/users-api";
import { ApiError } from "@/lib/api-client";
import type { TeamRosterOut } from "@/types/teams";
import type { UserListItemOut } from "@/types/users";
import { useAuth } from "@/lib/auth-context";

function initials(name: string) {
  return name
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

function RosterContent() {
  const { teamId } = useParams<{ teamId: string }>();
  const { hasPermission } = useAuth();
  const canManageTeams = hasPermission("teams:manage");
  const [roster, setRoster] = useState<TeamRosterOut | null>(null);
  const [allUsers, setAllUsers] = useState<UserListItemOut[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    const [rosterData, usersData] = await Promise.all([
      getRoster(teamId),
      canManageTeams ? listAssignableUsers() : Promise.resolve([]),
    ]);
    setRoster(rosterData);
    setAllUsers(usersData);
  }, [canManageTeams, teamId]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });

    return () => {
      cancelled = true;
    };
  }, [load]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!selectedUserId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await addMember(teamId, selectedUserId);
      setSelectedUserId("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add member.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemove(userId: string) {
    setError(null);
    try {
      await removeMember(teamId, userId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove member.");
    }
  }

  if (!roster) {
    return (
      <AppShell active="team" breadcrumb="Loading...">
        <p className="p-8 text-sm text-on-surface-variant">Loading...</p>
      </AppShell>
    );
  }

  const memberIds = new Set(roster.members.map((m) => m.user_id));
  const availableUsers = allUsers.filter((u) => !memberIds.has(u.id));

  return (
    <AppShell active="team" breadcrumb={roster.team.name}>
      <div className="px-gutter-lg py-space-lg max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">
              {roster.team.name}
            </h1>
            {roster.team.description && (
              <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">{roster.team.description}</p>
            )}
          </div>
          <Link href="/teams" className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface">
            ← Teams
          </Link>
        </div>

        {error && <p className="mb-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{error}</p>}

        {canManageTeams && <form onSubmit={handleAdd} className="mb-6 flex gap-2 rounded-xl bg-surface-container-lowest p-4 shadow-sm">
          <label htmlFor="team-member" className="sr-only">Assign member to team</label>
          <select
            id="team-member"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="flex-1 rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none"
          >
            <option value="">Assign a member...</option>
            {availableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email} ({u.role.name})
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isSubmitting || !selectedUserId}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-container disabled:opacity-50"
          >
            Add
          </button>
        </form>}

        {roster.members.length === 0 ? (
          <p className="font-body-md text-body-md text-on-surface-variant">No members yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
            {roster.members.map((member) => (
              <div key={member.user_id} className="rounded-xl bg-surface-container-lowest shadow-sm p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-space-sm min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-label-sm font-bold shrink-0">
                      {initials(member.full_name || member.email)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-title-sm text-title-sm font-semibold text-on-surface truncate">
                        {member.full_name || member.email}
                      </p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{member.email}</p>
                    </div>
                  </div>
                  {canManageTeams && <button
                    onClick={() => handleRemove(member.user_id)}
                    className="font-label-sm text-label-sm text-error hover:underline shrink-0"
                  >
                    Remove
                  </button>}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm font-semibold">
                    {member.role_name}
                  </span>
                  <span className="font-code-sm text-code-sm text-outline">
                    joined {new Date(member.joined_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function TeamRosterPage() {
  return (
    <RequireAuth permission="projects:view">
      <RosterContent />
    </RequireAuth>
  );
}
