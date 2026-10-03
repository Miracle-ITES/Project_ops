"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { addMember, getMembershipHistory, getRoster, removeMember } from "@/lib/teams-api";
import { listAssignableUsers } from "@/lib/users-api";
import { ApiError } from "@/lib/api-client";
import type { TeamMembershipHistoryOut, TeamRosterOut } from "@/types/teams";
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

function todayInputDate() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

function RosterContent() {
  const { teamId } = useParams<{ teamId: string }>();
  const { hasPermission } = useAuth();
  const canManageTeams = hasPermission("teams:manage");
  const [roster, setRoster] = useState<TeamRosterOut | null>(null);
  const [history, setHistory] = useState<TeamMembershipHistoryOut[]>([]);
  const [allUsers, setAllUsers] = useState<UserListItemOut[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [rosterData, historyData, usersData] = await Promise.all([
        getRoster(teamId),
        getMembershipHistory(teamId),
        canManageTeams ? listAssignableUsers() : Promise.resolve([]),
      ]);
      setRoster(rosterData);
      setHistory(historyData);
      setAllUsers(usersData);
    } catch (err) {
      setError(err instanceof ApiError ? `Failed to load team: ${err.message}` : "Failed to load team.");
    } finally {
      setIsLoading(false);
    }
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
      await addMember(teamId, selectedUserId, endDate || undefined);
      setSelectedUserId("");
      setEndDate("");
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

  if (isLoading && !roster) {
    return (
      <AppShell active="team" breadcrumb="Loading...">
        <p className="p-8 text-sm text-on-surface-variant">Loading...</p>
      </AppShell>
    );
  }

  if (!roster) {
    return (
      <AppShell active="team" breadcrumb="Team unavailable">
        <div className="p-8">
          <p className="text-sm text-error">{error || "Could not load this team."}</p>
          <Link href="/teams" className="mt-3 inline-block text-sm font-semibold text-secondary hover:underline">Back to teams</Link>
        </div>
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

        {canManageTeams && <form onSubmit={handleAdd} className="mb-6 flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:flex-row sm:items-end">
          <label htmlFor="team-member" className="flex-1 text-xs font-semibold text-outline">Member
            <select
              id="team-member"
              required
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-outline-variant px-3 py-2 text-sm font-normal text-on-surface focus:border-secondary focus:outline-none"
            >
              <option value="">Assign a member...</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email} ({u.role.name})
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="team-member-end-date" className="text-xs font-semibold text-outline">Membership ends on (optional)
            <input id="team-member-end-date" type="date" min={todayInputDate()} value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 block w-full rounded-lg border border-outline-variant px-3 py-2 text-sm font-normal text-on-surface focus:border-secondary focus:outline-none" />
          </label>
          <button
            type="submit"
            disabled={isSubmitting || !selectedUserId}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-container disabled:opacity-50"
          >
            {isSubmitting ? "Adding..." : "Add member"}
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
                  <span className="px-2 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm font-semibold">
                    {member.team_count} {member.team_count === 1 ? "team" : "teams"}
                  </span>
                  <span className="font-code-sm text-code-sm text-outline">
                    joined {new Date(member.joined_at).toLocaleDateString()}
                  </span>
                  <span className="font-code-sm text-code-sm text-outline">
                    {member.end_date ? `end date ${new Date(`${member.end_date}T00:00:00`).toLocaleDateString()}` : "no end date"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <section className="mt-8 rounded-xl bg-surface-container-lowest p-5 shadow-sm">
          <h2 className="font-headline-md font-bold text-on-surface">Membership history</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Removed members and completed membership timelines.</p>
          {history.length === 0 ? <p className="mt-4 text-sm text-on-surface-variant">No membership history yet.</p> : <div className="mt-4 space-y-3">
            {history.map((entry) => {
              const completed = !entry.left_at && !!entry.end_date && new Date(`${entry.end_date}T00:00:00`) < new Date(new Date().toDateString());
              return <article key={`${entry.user_id}-${entry.joined_at}`} className="flex flex-col gap-2 border-t border-outline-variant/40 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-on-surface">{entry.full_name || entry.email}</p>
                  <p className="text-xs text-on-surface-variant">{entry.email} · {entry.role_name} · {new Date(entry.joined_at).toLocaleDateString()} – {entry.left_at ? new Date(entry.left_at).toLocaleDateString() : entry.end_date ? new Date(`${entry.end_date}T00:00:00`).toLocaleDateString() : ""}</p>
                </div>
                <span className={`w-fit rounded-full px-2 py-1 text-xs font-semibold ${completed ? "bg-secondary-container/60 text-on-secondary-container" : "bg-surface-container-high text-on-surface-variant"}`}>
                  {completed ? "Timeline completed" : `Removed${entry.left_at ? ` · ${new Date(entry.left_at).toLocaleDateString()}` : ""}`}
                </span>
              </article>;
            })}
          </div>}
        </section>
      </div>
    </AppShell>
  );
}

export default function TeamRosterPage() {
  return (
    <RequireAuth anyPermissions={["projects:view", "teams:manage", "project_teams:manage", "teams:view_own_roster"]}>
      <RosterContent />
    </RequireAuth>
  );
}
