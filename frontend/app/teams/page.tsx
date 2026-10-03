"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { createTeam, deleteTeam, listMyTeams, listTeams, updateTeamName } from "@/lib/teams-api";
import { ApiError } from "@/lib/api-client";
import type { TeamOut } from "@/types/teams";
import { Dialog } from "../../components/dialog";
import { useAuth } from "@/lib/auth-context";

function TeamsContent() {
  const { hasPermission } = useAuth();
  const canManageTeams = hasPermission("teams:manage");
  const canAdministerTeams = hasPermission("users:manage");
  const canViewAllTeams = canManageTeams || hasPermission("project_teams:manage") || hasPermission("projects:view");
  const [teams, setTeams] = useState<TeamOut[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamOut | null>(null);
  const [editName, setEditName] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const filteredTeams = teams.filter((team) => {
    const query = search.trim().toLowerCase();
    return !query || team.name.toLowerCase().includes(query) || (team.description || "").toLowerCase().includes(query);
  });

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setTeams(await (canViewAllTeams ? listTeams() : listMyTeams()));
    } catch (err) {
      setTeams([]);
      setError(err instanceof ApiError ? `Failed to load teams: ${err.message}` : "Failed to load teams.");
    } finally {
      setIsLoading(false);
    }
  }, [canViewAllTeams]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });

    return () => {
      cancelled = true;
    };
  }, [load]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await createTeam({ name, description: description || undefined });
      setName("");
      setDescription("");
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create team.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRename(e: FormEvent) {
    e.preventDefault();
    if (!editingTeam || !editName.trim()) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await updateTeamName(editingTeam.id, editName.trim());
      setEditingTeam(null);
      setEditName("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update team name.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(team: TeamOut) {
    if (!window.confirm(`Delete “${team.name}”? This will also remove its membership history and project assignments.`)) return;
    setError(null);
    try {
      await deleteTeam(team.id);
      setTeams((current) => current.filter((item) => item.id !== team.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete team.");
    }
  }

  return (
    <AppShell active="team" breadcrumb="Team Management">
      <div className="px-4 sm:px-gutter-lg py-space-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md mb-space-lg">
          <div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">
              Team &amp; Organizational Roster
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
            {canViewAllTeams ? "Manage teams and their membership." : "Teams you belong to and their members."}
            </p>
          </div>
          {canManageTeams && <button
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md font-semibold shadow-sm self-start"
          >
            <Plus size={18} aria-hidden="true" />
            Add Team
          </button>}
        </div>

        {error && !showForm && <p className="mb-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md mb-space-lg">
          <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm">
            <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold text-outline">
              Total Teams
            </span>
            <div className="mt-3 font-display-lg text-display-lg font-bold text-on-surface tracking-tight">
              {isLoading ? "…" : teams.length}
            </div>
          </div>
        </div>

        {showForm && (
          <Dialog title="Add team" description="Create a team for shared project work." onClose={() => setShowForm(false)}>
            <form onSubmit={handleCreate} className="space-y-3">
              {error && <p className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{error}</p>}
              <input
                required
                placeholder="Team name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none"
              />
              <input
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-container disabled:opacity-50"
              >
                {isSubmitting ? "Creating..." : "Create team"}
              </button>
            </form>
          </Dialog>
        )}

        {editingTeam && <Dialog title="Edit team name" description="Update the name shown across the team roster and project assignments." onClose={() => setEditingTeam(null)}>
          <form onSubmit={(event) => void handleRename(event)} className="space-y-3">
            {error && <p role="alert" className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{error}</p>}
            <label className="block text-sm font-medium text-on-surface-variant">Team name
              <input required maxLength={150} autoFocus value={editName} onChange={(event) => setEditName(event.target.value)} className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface focus:border-secondary focus:outline-none" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingTeam(null)} className="rounded-lg border border-outline-variant px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={isSubmitting || !editName.trim()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-50">{isSubmitting ? "Saving..." : "Save name"}</button>
            </div>
          </form>
        </Dialog>}

        <label className="mb-4 block max-w-xl text-xs font-semibold text-outline">
          Search teams
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by team name or description"
            className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm font-normal text-on-surface focus:border-secondary focus:outline-none"
          />
        </label>

        {isLoading ? (
          <p className="font-body-md text-body-md text-on-surface-variant">Loading...</p>
        ) : teams.length === 0 ? (
          <p className="font-body-md text-body-md text-on-surface-variant">No teams yet.</p>
        ) : filteredTeams.length === 0 ? (
          <p className="font-body-md text-body-md text-on-surface-variant">No teams match your search.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
            {filteredTeams.map((team) => (
              <article key={team.id} className="rounded-xl bg-surface-container-lowest p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-start gap-3">
                  <Link href={`/teams/${team.id}`} className="block min-w-0 flex-1">
                    <div className="mb-2 flex min-w-0 items-center gap-space-sm">
                      <UsersRound size={20} className="shrink-0 text-secondary" aria-hidden="true" />
                      <span className="truncate font-title-sm text-title-sm font-semibold text-on-surface">{team.name}</span>
                    </div>
                    {team.description && <p className="font-body-sm text-body-sm text-on-surface-variant">{team.description}</p>}
                  </Link>
                  {canAdministerTeams && <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => { setEditName(team.name); setEditingTeam(team); }} aria-label={`Edit name for ${team.name}`} title="Edit team name" className="rounded-lg border border-outline-variant p-2 text-on-surface hover:border-secondary hover:text-secondary"><Pencil size={16} aria-hidden="true" /></button>
                    <button type="button" onClick={() => void handleDelete(team)} aria-label={`Delete ${team.name}`} title="Delete team" className="rounded-lg border border-error/40 p-2 text-error hover:border-error"><Trash2 size={16} aria-hidden="true" /></button>
                  </div>}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function TeamsPage() {
  return (
    <RequireAuth anyPermissions={["projects:view", "teams:manage", "project_teams:manage", "teams:view_own_roster"]}>
      <TeamsContent />
    </RequireAuth>
  );
}
