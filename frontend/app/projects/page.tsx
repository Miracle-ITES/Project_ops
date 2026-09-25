"use client";

import { useCallback, useEffect, useState, type SubmitEventHandler } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { createProject, listProjects } from "@/lib/projects-api";
import { ApiError } from "@/lib/api-client";
import type { ProjectListItemOut, ProjectMaturity, ProjectPriority } from "@/types/projects";
import { Dialog } from "../../components/dialog";

const HEALTH_BADGE: Record<ProjectMaturity, { text: string; dot: string; className: string }> = {
  planning: { text: "Planning", dot: "bg-outline", className: "bg-surface-container-high text-on-surface-variant" },
  active: { text: "Healthy", dot: "bg-secondary", className: "bg-secondary-container/60 text-on-secondary-container" },
  at_risk: { text: "At Risk", dot: "bg-amber-600", className: "bg-amber-100 text-amber-900" },
  blocked: { text: "Blocked", dot: "bg-error", className: "bg-error-container text-on-error-container" },
  completed: { text: "Completed", dot: "bg-secondary", className: "bg-secondary-container/60 text-on-secondary-container" },
};

function ProjectsContent() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("projects:create");

  const [projects, setProjects] = useState<ProjectListItemOut[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [priority, setPriority] = useState<ProjectPriority>("medium");
  const [maturity, setMaturity] = useState<ProjectMaturity>("planning");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);

    try {
      setProjects(await listProjects());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to load projects."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void listProjects()
      .then((loadedProjects) => {
        if (!cancelled) {
          setProjects(loadedProjects);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Failed to load projects."
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate: SubmitEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await createProject({ name, priority, maturity });
      setName("");
      setPriority("medium");
      setMaturity("planning");
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create project.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const healthy = projects.filter((p) => p.maturity === "active" || p.maturity === "completed").length;
  const atRisk = projects.filter((p) => p.maturity === "at_risk").length;
  const blocked = projects.filter((p) => p.maturity === "blocked").length;

  return (
    <AppShell active="projects" breadcrumb="Projects Directory">
      <div className="px-gutter-lg py-space-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md mb-space-lg">
          <div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">
              Projects &amp; Initiatives
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
              Track cross-functional initiatives, milestones, priority, and maturity.
            </p>
          </div>
          {canCreate && (
            <button
              onClick={() => setShowForm((s) => !s)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md font-semibold shadow-sm transition-all self-start"
            >
              <Plus size={18} aria-hidden="true" />
              New Project
            </button>
          )}
        </div>

        {/* KPI cards — Total Active Scope, Healthy/At Risk/Blocked are
            real, derived from your actual project data. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md mb-space-lg">
          <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm">
            <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold text-outline">
              Total Active Scope
            </span>
            <div className="mt-3 font-display-lg text-display-lg font-bold text-on-surface tracking-tight">
              {isLoading ? "…" : projects.length} <span className="text-title-sm font-normal text-on-surface-variant">Projects</span>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm">
            <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold text-outline">
              Health Breakdown
            </span>
            <div className="mt-3 flex gap-2 flex-wrap">
              <span className="px-2 py-1 rounded-md bg-secondary-container/60 text-on-secondary-container font-label-sm text-label-sm font-semibold">
                {healthy} Healthy
              </span>
              <span className="px-2 py-1 rounded-md bg-amber-100 text-amber-900 font-label-sm text-label-sm font-semibold">
                {atRisk} At Risk
              </span>
              <span className="px-2 py-1 rounded-md bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold">
                {blocked} Blocked
              </span>
            </div>
          </div>
        </div>

        {canCreate && showForm && (
          <Dialog title="New project" description="Add an initiative to your project directory." onClose={() => setShowForm(false)}>
            <form onSubmit={handleCreate} className="space-y-3">
              {error && <p className="rounded-md bg-error-container px-3 py-2 text-sm text-on-error-container">{error}</p>}
              <input
                required
                placeholder="Project name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none"
              />
              <div className="flex gap-3">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as ProjectPriority)}
                  className="flex-1 rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none"
                >
                  <option value="low">Low priority</option>
                  <option value="medium">Medium priority</option>
                  <option value="high">High priority</option>
                  <option value="critical">Critical priority</option>
                </select>
                <select
                  value={maturity}
                  onChange={(e) => setMaturity(e.target.value as ProjectMaturity)}
                  className="flex-1 rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none"
                >
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="at_risk">At Risk</option>
                  <option value="blocked">Blocked</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-container disabled:opacity-50"
              >
                {isSubmitting ? "Creating..." : "Create project"}
              </button>
            </form>
          </Dialog>
        )}

        <div className="rounded-xl bg-surface-container-lowest shadow-sm p-space-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-body-md text-body-md">
              <thead>
                <tr className="text-outline font-label-sm text-label-sm uppercase tracking-wider bg-surface-container-low/50">
                  <th className="py-2.5 px-3 rounded-l-md">Project</th>
                  <th className="py-2.5 px-3">Owner</th>
                  <th className="py-2.5 px-3">Priority</th>
                  <th className="py-2.5 px-3 rounded-r-md">Health</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="py-6 px-3 text-on-surface-variant">Loading...</td>
                  </tr>
                ) : projects.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 px-3 text-on-surface-variant">No projects yet.</td>
                  </tr>
                ) : (
                  projects.map((p) => {
                    const badge = HEALTH_BADGE[p.maturity];
                    return (
                      <tr key={p.id} className="hover:bg-surface-container-low/60 transition-colors">
                        <td className="py-3 px-3">
                          <Link href={`/projects/${p.id}`} className="font-title-sm text-title-sm font-semibold text-on-surface hover:text-secondary">
                            {p.name}
                          </Link>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-on-surface font-medium">
                          {p.owner.full_name || p.owner.email}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap capitalize text-on-surface-variant">
                          {p.priority}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${badge.className}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                            {badge.text}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function ProjectsPage() {
  return (
    <RequireAuth permission="projects:view">
      <ProjectsContent />
    </RequireAuth>
  );
}
