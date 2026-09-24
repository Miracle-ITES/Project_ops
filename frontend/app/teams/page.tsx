"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Plus, UsersRound } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { createTeam, listTeams } from "@/lib/teams-api";
import { ApiError } from "@/lib/api-client";
import type { TeamOut } from "@/types/teams";
import { Dialog } from "../../components/dialog";
import { useAuth } from "@/lib/auth-context";

function TeamsContent() {
  const { hasPermission } = useAuth();
  const canManageTeams = hasPermission("teams:manage");
  const [teams, setTeams] = useState<TeamOut[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function load() {
    setIsLoading(true);
    try {
      setTeams(await listTeams());
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });

    return () => {
      cancelled = true;
    };
  }, []);

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

  return (
    <AppShell active="team" breadcrumb="Team Management">
      <div className="px-gutter-lg py-space-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md mb-space-lg">
          <div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">
              Team &amp; Organizational Roster
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
              Manage teams and their membership.
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md mb-space-lg">
          <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm">
            <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold text-outline">
              Total Teams
            </span>
            <div className="mt-3 font-display-lg text-display-lg font-bold text-on-surface tracking-tight">
              {isLoading ? "…" : teams.length}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm">
            <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold text-outline">
              Capacity Allocation
            </span>
            <div className="mt-3 font-display-lg text-display-lg font-bold text-on-surface tracking-tight">84%</div>
            <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">Placeholder — no capacity metric yet</p>
          </div>
          <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm">
            <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold text-outline">
              On-call Responders
            </span>
            <div className="mt-3 font-display-lg text-display-lg font-bold text-on-surface tracking-tight">4</div>
            <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">Placeholder — no on-call module yet</p>
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

        {isLoading ? (
          <p className="font-body-md text-body-md text-on-surface-variant">Loading...</p>
        ) : teams.length === 0 ? (
          <p className="font-body-md text-body-md text-on-surface-variant">No teams yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
            {teams.map((team) => (
              <Link
                key={team.id}
                href={`/teams/${team.id}`}
                className="rounded-xl bg-surface-container-lowest shadow-sm p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-space-sm mb-2">
                  <UsersRound size={20} className="text-secondary" aria-hidden="true" />
                  <span className="font-title-sm text-title-sm font-semibold text-on-surface">{team.name}</span>
                </div>
                {team.description && (
                  <p className="font-body-sm text-body-sm text-on-surface-variant">{team.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function TeamsPage() {
  return (
    <RequireAuth permission="projects:view">
      <TeamsContent />
    </RequireAuth>
  );
}
