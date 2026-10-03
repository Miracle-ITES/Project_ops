"use client";

import { useCallback, useEffect, useState, type SubmitEventHandler } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { addContributor, addMilestone, addTeam, getProject, listProjectMembers, removeContributor, removeTeam, updateMilestoneStatus, updateProject } from "@/lib/projects-api";
import { listAssignableTeams } from "@/lib/teams-api";
import { ApiError } from "@/lib/api-client";
import type { MilestoneStatus, ProjectDetailOut, ProjectMaturity, ProjectPriority } from "@/types/projects";
import type { TeamOut } from "@/types/teams";
import type { ContributorOut } from "@/types/projects";

const HEALTH_BADGE: Record<ProjectMaturity, { text: string; dot: string; className: string }> = {
  planning: { text: "Planning", dot: "bg-outline", className: "bg-surface-container-high text-on-surface-variant" },
  active: { text: "Healthy", dot: "bg-secondary", className: "bg-secondary-container/60 text-on-secondary-container" },
  at_risk: { text: "At Risk", dot: "bg-amber-600", className: "bg-amber-100 text-amber-900" },
  blocked: { text: "Blocked", dot: "bg-error", className: "bg-error-container text-on-error-container" },
  completed: { text: "Completed", dot: "bg-secondary", className: "bg-secondary-container/60 text-on-secondary-container" },
};

function todayInputDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function ProjectDetailContent() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission("projects:create");
  const canManageTeams = hasPermission("project_teams:manage");

  const [project, setProject] = useState<ProjectDetailOut | null>(null);
  const [allUsers, setAllUsers] = useState<ContributorOut[]>([]);
  const [allTeams, setAllTeams] = useState<TeamOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [contributorId, setContributorId] = useState("");
  const [contributorEndDate, setContributorEndDate] = useState("");
  const [teamId, setTeamId] = useState("");
  const [milestoneName, setMilestoneName] = useState("");
  const [milestoneDueDate, setMilestoneDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [priority, setPriority] = useState<ProjectPriority>("medium");
  const [maturity, setMaturity] = useState<ProjectMaturity>("planning");

  const load = useCallback(async () => {
    try {
      const requests: [Promise<ProjectDetailOut>, Promise<ContributorOut[]>] = [
        getProject(projectId),
        canManage ? listProjectMembers(projectId) : Promise.resolve([]),
      ];
      const [projectData, usersData, teamsData] = await Promise.all([
        ...requests,
        canManageTeams ? listAssignableTeams() : Promise.resolve([]),
      ]);
      setProject(projectData);
      setPriority(projectData.priority);
      setMaturity(projectData.maturity);
      setAllUsers(usersData);
      setAllTeams(teamsData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load project.");
    }
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
      if (!contributorEndDate) return;
      await addContributor(projectId, contributorId, contributorEndDate);
      setContributorId("");
      setContributorEndDate("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add contributor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemoveContributor(userId: string) {
    setError(null);
    setIsSubmitting(true);
    try {
      await removeContributor(projectId, userId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove contributor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMilestoneStatusChange(milestoneId: string, status: MilestoneStatus) {
    if (status === "completed" && !window.confirm("Confirm that you reviewed this milestone and it is complete?")) return;
    setError(null);
    setIsSubmitting(true);
    try {
      setProject(await updateMilestoneStatus(projectId, milestoneId, status));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update milestone status.");
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

  const handleProjectHealthUpdate: SubmitEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const updated = await updateProject(projectId, { priority, maturity });
      setProject(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update project health and priority.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!project) {
    return (
      <AppShell active="projects" breadcrumb={error ? "Unable to load project" : "Loading..."}>
        {error ? (
          <p className="m-8 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{error}</p>
        ) : (
          <p className="p-8 text-sm text-on-surface-variant">Loading...</p>
        )}
      </AppShell>
    );
  }

  const badge = HEALTH_BADGE[project.maturity];
  const isProjectOwner = user?.id === project.owner.id;
  const contributorIds = new Set(project.contributors.map((c) => c.user_id));
  const availableUsers = allUsers.filter((u) => u.user_id !== project.owner.id && !contributorIds.has(u.user_id));
  const assignedTeamIds = new Set(project.teams.map((team) => team.team_id));
  const availableTeams = allTeams.filter((team) => !assignedTeamIds.has(team.id));

  return (
    <AppShell active="projects" breadcrumb={project.name}>
      <div className="px-4 sm:px-gutter-lg py-space-lg mx-auto w-full max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="break-words font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">
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
          <Link href="/projects" className="self-start font-label-md text-label-md text-on-surface-variant hover:text-on-surface sm:self-auto">
            ← Projects
          </Link>
        </div>

        {project.description && (
          <p className="mb-6 font-body-md text-body-md text-on-surface">{project.description}</p>
        )}

        {error && <p className="mb-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{error}</p>}

        {canManage && (
          <section className="mb-6 rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
            <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Project health and priority</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Update these values as the project changes.</p>
            <form onSubmit={handleProjectHealthUpdate} className="mt-4 flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-sm font-medium text-on-surface">
                Health
                <select value={maturity} onChange={(e) => setMaturity(e.target.value as ProjectMaturity)} className="min-w-44 rounded-lg border border-outline-variant px-3 py-2 text-sm">
                  <option value="planning">Planning</option>
                  <option value="active">Healthy / Active</option>
                  <option value="at_risk">At risk</option>
                  <option value="blocked">Blocked</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-on-surface">
                Priority
                <select value={priority} onChange={(e) => setPriority(e.target.value as ProjectPriority)} className="min-w-44 rounded-lg border border-outline-variant px-3 py-2 text-sm">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
              <button type="submit" disabled={isSubmitting || (priority === project.priority && maturity === project.maturity)} className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-50 sm:w-auto">
                {isSubmitting ? "Saving..." : "Save changes"}
              </button>
            </form>
          </section>
        )}

        <div className="mb-6 grid items-start gap-6 lg:grid-cols-2">
        <section className="rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
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
            <form onSubmit={handleAddTeam} className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor="project-team" className="sr-only">Assign team to project</label>
              <select id="project-team" value={teamId} onChange={(e) => setTeamId(e.target.value)} className="flex-1 rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none">
                <option value="">Assign a team...</option>
                {availableTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
              <button type="submit" disabled={isSubmitting || !teamId} className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-container disabled:opacity-50 sm:w-auto">Assign</button>
            </form>
          )}
        </section>

        <section className="rounded-xl bg-surface-container-lowest shadow-sm p-space-md">
          <h2 className="mb-3 font-headline-md text-headline-md font-bold text-on-surface">Members</h2>
          <div className="mb-4 space-y-2">
            {project.contributors.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">No member yet.</p>
            ) : (
              project.contributors.map((c) => (
                <div key={`${c.user_id}-${c.added_at || "assigned"}`} className="flex flex-col gap-3 rounded-lg bg-surface-container-low/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-on-surface">{c.full_name || c.email}</p>
                    <p className="truncate text-sm text-on-surface-variant">{c.email}</p>
                    <p className="mt-1 text-xs text-outline">{c.added_at ? `Assigned ${new Date(c.added_at).toLocaleDateString()}` : "Assigned"}{c.end_date ? ` · Through ${new Date(`${c.end_date}T00:00:00`).toLocaleDateString()}` : " · No end date"}</p>
                  </div>
                  {canManage && <button type="button" disabled={isSubmitting} onClick={() => void handleRemoveContributor(c.user_id)} className="self-start font-label-sm text-label-sm text-error hover:underline disabled:opacity-50">Remove</button>}
                </div>
              ))
            )}
          </div>
          {canManage && (
            <form onSubmit={handleAddContributor} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label htmlFor="project-contributor" className="text-xs font-semibold text-outline">Assign a member
                <select
                  id="project-contributor"
                  required
                  value={contributorId}
                  onChange={(e) => setContributorId(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-outline-variant px-3 py-2 text-sm font-normal text-on-surface focus:border-secondary focus:outline-none"
                >
                  <option value="">Select member...</option>
                  {availableUsers.map((u) => (
                    <option key={u.user_id} value={u.user_id}>{u.email}</option>
                  ))}
                </select>
              </label>
              <label htmlFor="project-contributor-end-date" className="text-xs font-semibold text-outline">Assigned through
                <input id="project-contributor-end-date" type="date" required min={todayInputDate()} value={contributorEndDate} onChange={(event) => setContributorEndDate(event.target.value)} className="mt-1 block w-full rounded-lg border border-outline-variant px-3 py-2 text-sm font-normal text-on-surface focus:border-secondary focus:outline-none" />
              </label>
              <button
                type="submit"
                disabled={isSubmitting || !contributorId || !contributorEndDate}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-container disabled:opacity-50 sm:col-span-2 sm:justify-self-start"
              >
                {isSubmitting ? "Adding..." : "Add contributor"}
              </button>
            </form>
          )}
        </section>
        </div>

        <section className="rounded-xl bg-surface-container-lowest shadow-sm p-space-md">
          <h2 className="mb-3 font-headline-md text-headline-md font-bold text-on-surface">Milestones</h2>
          <p className="mb-4 text-sm text-on-surface-variant">A past due date is a review reminder; it never completes a milestone automatically.</p>
          <div className="mb-3 space-y-2">
            {project.milestones.length === 0 ? (
              <p className="font-body-md text-body-md text-on-surface-variant">No milestones yet.</p>
            ) : (
              project.milestones.map((m) => (
                <div key={m.id} className="flex flex-col gap-3 rounded-lg bg-surface-container-low/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-on-surface">{m.name}</p>
                    <p className="mt-1 text-sm text-on-surface-variant">Due {m.due_date ? new Date(`${m.due_date}T00:00:00`).toLocaleDateString() : "date not set"}</p>
                    {m.due_date && new Date(`${m.due_date}T00:00:00`) < new Date(new Date().toDateString()) && m.status !== "completed" && <p role="status" className="mt-1 text-sm font-medium text-amber-800">Past due · review milestone status</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-semibold capitalize text-on-surface-variant">{m.status.replace("_", " ")}</span>
                    {isProjectOwner && m.status !== "completed" && <button type="button" disabled={isSubmitting} onClick={() => void handleMilestoneStatusChange(m.id, "completed")} className="rounded-lg border border-secondary px-3 py-1.5 text-sm font-semibold text-secondary hover:bg-secondary-container/40 disabled:opacity-50">Mark complete</button>}
                  </div>
                </div>
              ))
            )}
          </div>
          {canManage && (
            <form onSubmit={handleAddMilestone} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
              <input
                required
                placeholder="Milestone name"
                value={milestoneName}
                onChange={(e) => setMilestoneName(e.target.value)}
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none"
              />
              <input
                type="date"
                value={milestoneDueDate}
                onChange={(e) => setMilestoneDueDate(e.target.value)}
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none"
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
    <RequireAuth anyPermissions={["projects:view", "projects:view_assigned"]}>
      <ProjectDetailContent />
    </RequireAuth>
  );
}
