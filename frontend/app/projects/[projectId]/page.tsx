"use client";

import { useCallback, useEffect, useState, type SubmitEventHandler } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { addContributor, addMilestone, addTeam, getProject, removeTeam } from "@/lib/projects-api";
import { listAssignableTeams } from "@/lib/teams-api";
import { listAssignableUsers } from "@/lib/users-api";
import { ApiError } from "@/lib/api-client";
import type { ProjectDetailOut, ProjectMaturity } from "@/types/projects";
import type { TeamOut } from "@/types/teams";
import type { UserListItemOut } from "@/types/users";

const HEALTH_BADGE: Record<ProjectMaturity, { text: string; dot: string; className: string }> = {
  planning: { text: "Planning", dot: "bg-outline", className: "bg-surface-container-high text-on-surface-variant" },
  active: { text: "Healthy", dot: "bg-secondary", className: "bg-secondary-container/60 text-on-secondary-container" },
  at_risk: { text: "At Risk", dot: "bg-amber-600", className: "bg-amber-100 text-amber-900" },
  blocked: { text: "Blocked", dot: "bg-error", className: "bg-error-container text-on-error-container" },
  completed: { text: "Completed", dot: "bg-secondary", className: "bg-secondary-container/60 text-on-secondary-container" },
};

function ProjectDetailContent() {
  const { projectId } = useParams<{ projectId: string }>();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("projects:create");
  const canManageTeams = hasPermission("project_teams:manage");

  const [project, setProject] = useState<ProjectDetailOut | null>(null);
  const [allUsers, setAllUsers] = useState<UserListItemOut[]>([]);
  const [allTeams, setAllTeams] = useState<TeamOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [contributorId, setContributorId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [milestoneName, setMilestoneName] = useState("");
  const [milestoneDueDate, setMilestoneDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    const requests: [Promise<ProjectDetailOut>, Promise<UserListItemOut[]>] = [
      getProject(projectId),
      canManage ? listAssignableUsers() : Promise.resolve([]),
    ];
    const [projectData, usersData, teamsData] = await Promise.all([
      ...requests,
      canManageTeams ? listAssignableTeams() : Promise.resolve([]),
    ]);
    setProject(projectData);
    setAllUsers(usersData);
    setAllTeams(teamsData);
  }, [canManage, canManageTeams, projectId]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });

    return () => {
      cancelled = true;
    };
  }, [load]);

  const handleAddContributor: SubmitEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    if (!contributorId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await addContributor(projectId, contributorId);
      setContributorId("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add contributor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleAddTeam: SubmitEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    if (!teamId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await addTeam(projectId, teamId);
      setTeamId("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to assign team.");
    } finally {
      setIsSubmitting(false);
    }
  };

  async function handleRemoveTeam(assignedTeamId: string) {
    setError(null);
    setIsSubmitting(true);
    try {
      await removeTeam(projectId, assignedTeamId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove team.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleAddMilestone: SubmitEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    if (!milestoneName) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await addMilestone(projectId, { name: milestoneName, due_date: milestoneDueDate || undefined });
      setMilestoneName("");
      setMilestoneDueDate("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add milestone.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!project) {
    return (
      <AppShell active="projects" breadcrumb="Loading...">
        <p className="p-8 text-sm text-on-surface-variant">Loading...</p>
      </AppShell>
    );
  }

  const badge = HEALTH_BADGE[project.maturity];
  const contributorIds = new Set(project.contributors.map((c) => c.user_id));
  const availableUsers = allUsers.filter((u) => u.id !== project.owner.id && !contributorIds.has(u.id));
  const assignedTeamIds = new Set(project.teams.map((team) => team.team_id));
  const availableTeams = allTeams.filter((team) => !assignedTeamIds.has(team.id));

  return (
    <AppShell active="projects" breadcrumb={project.name}>
      <div className="px-gutter-lg py-space-lg max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">
                {project.name}
              </h1>
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${badge.className}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                {badge.text}
              </span>
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Owner: {project.owner.email} · <span className="capitalize">{project.priority}</span> priority
            </p>
          </div>
          <Link href="/projects" className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface">
            ← Projects
          </Link>
        </div>

        {project.description && (
          <p className="mb-6 font-body-md text-body-md text-on-surface">{project.description}</p>
        )}

        {error && <p className="mb-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{error}</p>}

        <section className="mb-6 rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Assigned teams</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">Only administrators and team leads can manage project teams.</p>
            </div>
          </div>
          <div className="mb-3 space-y-2">
            {project.teams.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">No teams assigned yet.</p>
            ) : (
              project.teams.map((team) => (
                <div key={team.team_id} className="flex items-center justify-between rounded-lg bg-surface-container-low/60 p-3">
                  <div>
                    <p className="font-title-sm text-title-sm font-semibold text-on-surface">{team.name}</p>
                    {team.description && <p className="text-xs text-on-surface-variant">{team.description}</p>}
                  </div>
                  {canManageTeams && <button type="button" onClick={() => void handleRemoveTeam(team.team_id)} className="font-label-sm text-label-sm text-error hover:underline">Remove</button>}
                </div>
              ))
            )}
          </div>
          {canManageTeams && (
            <form onSubmit={handleAddTeam} className="flex gap-2">
              <label htmlFor="project-team" className="sr-only">Assign team to project</label>
              <select id="project-team" value={teamId} onChange={(e) => setTeamId(e.target.value)} className="flex-1 rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none">
                <option value="">Assign a team...</option>
                {availableTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
              <button type="submit" disabled={isSubmitting || !teamId} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-container disabled:opacity-50">Assign</button>
            </form>
          )}
        </section>

        <section className="mb-6 rounded-xl bg-surface-container-lowest shadow-sm p-space-md">
          <h2 className="mb-3 font-headline-md text-headline-md font-bold text-on-surface">Contributors</h2>
          <div className="mb-3 space-y-1">
            {project.contributors.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">No contributors yet.</p>
            ) : (
              project.contributors.map((c) => (
                <p key={c.user_id} className="font-body-md text-body-md text-on-surface">{c.email}</p>
              ))
            )}
          </div>
          {canManage && (
            <form onSubmit={handleAddContributor} className="flex gap-2">
              <label htmlFor="project-contributor" className="sr-only">Assign member to project</label>
              <select
                id="project-contributor"
                value={contributorId}
                onChange={(e) => setContributorId(e.target.value)}
                className="flex-1 rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none"
              >
                <option value="">Assign a member...</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.email}</option>
                ))}
              </select>
              <button
                type="submit"
                disabled={isSubmitting || !contributorId}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-container disabled:opacity-50"
              >
                Add
              </button>
            </form>
          )}
        </section>

        <section className="rounded-xl bg-surface-container-lowest shadow-sm p-space-md">
          <h2 className="mb-3 font-headline-md text-headline-md font-bold text-on-surface">Milestones</h2>
          <div className="mb-3 space-y-2">
            {project.milestones.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">No milestones yet.</p>
            ) : (
              project.milestones.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg bg-surface-container-low/60 p-3">
                  <span className="text-sm text-on-surface">{m.name}</span>
                  <span className="text-xs text-on-surface-variant">
                    {m.due_date ? new Date(m.due_date).toLocaleDateString() : "No due date"} · {m.status}
                  </span>
                </div>
              ))
            )}
          </div>
          {canManage && (
            <form onSubmit={handleAddMilestone} className="flex gap-2">
              <input
                required
                placeholder="Milestone name"
                value={milestoneName}
                onChange={(e) => setMilestoneName(e.target.value)}
                className="flex-1 rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none"
              />
              <input
                type="date"
                value={milestoneDueDate}
                onChange={(e) => setMilestoneDueDate(e.target.value)}
                className="rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSubmitting || !milestoneName}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-container disabled:opacity-50"
              >
                Add
              </button>
            </form>
          )}
        </section>
      </div>
    </AppShell>
  );
}

export default function ProjectDetailPage() {
  return (
    <RequireAuth permission="projects:view">
      <ProjectDetailContent />
    </RequireAuth>
  );
}
