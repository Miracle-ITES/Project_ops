"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { listProjects } from "@/lib/projects-api";
import { getDashboard } from "@/lib/work-api";
import type { Dashboard } from "@/types/work";
import type { ProjectListItemOut, ProjectMaturity } from "@/types/projects";

const HEALTH_BADGE: Record<ProjectMaturity, { text: string; dot: string; className: string }> = {
  planning: { text: "Planning", dot: "bg-outline", className: "bg-surface-container-high text-on-surface-variant" },
  active: { text: "Healthy", dot: "bg-secondary", className: "bg-secondary-container/60 text-on-secondary-container" },
  at_risk: { text: "At Risk", dot: "bg-amber-600", className: "bg-amber-100 text-amber-900" },
  blocked: { text: "Blocked", dot: "bg-error", className: "bg-error-container text-on-error-container" },
  completed: { text: "Completed", dot: "bg-secondary", className: "bg-secondary-container/60 text-on-secondary-container" },
};

function DashboardContent() {
  const { user, hasPermission } = useAuth();
  const isMember = user?.role.name === "Member";
  const [projects, setProjects] = useState<ProjectListItemOut[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<Dashboard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAllDeadlines, setShowAllDeadlines] = useState(false);

  const refreshDashboard = useCallback(async () => {
    const [projectResult, metricsResult] = await Promise.allSettled([listProjects(), getDashboard()]);
    if (projectResult.status === "fulfilled") setProjects(projectResult.value);
    if (metricsResult.status === "fulfilled") setMetrics(metricsResult.value);
    setLoadError(projectResult.status === "rejected" || metricsResult.status === "rejected"
      ? "Some dashboard data could not be refreshed. Please try again."
      : null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void refreshDashboard());
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") void refreshDashboard();
    };
    const interval = window.setInterval(refreshIfVisible, 30_000);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [refreshDashboard]);

  const firstName = (user?.full_name || user?.email || "").split(/[\s@]/)[0];

  return (
    <AppShell active="dashboard" breadcrumb="Executive Overview">
      <div className="px-4 sm:px-gutter-lg py-space-lg">
        {loadError && <p role="alert" className="mb-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{loadError}</p>}
        {/* Header row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md mb-space-lg">
          <div>
            <h1 className="font-headline-xl text-headline-xl text-on-surface font-bold tracking-tight">
              Good morning{firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
              Here&apos;s an overview of your team&apos;s work.
            </p>
          </div>
          {hasPermission("daily_updates:submit") && (
            <Link href="/updates#daily-status" className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-container">
              Submit daily status
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-space-md mb-space-lg">
          <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm">
            <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold text-outline">
              Active Projects
            </span>
            <div className="mt-3 font-display-lg text-display-lg font-bold text-on-surface tracking-tight">
              {isLoading ? "…" : metrics?.active_projects ?? 0}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm">
            <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold text-outline">Critical Projects</span>
            <div className="mt-3 font-display-lg text-display-lg font-bold text-error tracking-tight">{isLoading ? "…" : metrics?.critical_projects ?? 0}</div>
          </div>
          <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm">
            <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold text-outline">
              Tasks Due Today
            </span>
            <div className="mt-3 font-display-lg text-display-lg font-bold text-on-surface tracking-tight">{isLoading ? "…" : metrics?.tasks_due_today ?? 0}</div>
          </div>
          <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm">
            <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold text-outline">
              Open Tickets
            </span>
            <div className="mt-3 font-display-lg text-display-lg font-bold text-error tracking-tight">{isLoading ? "…" : metrics?.open_tickets ?? 0}</div>
          </div>
          {!isMember && <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm">
            <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold text-outline">
              Team Progress
            </span>
            <div className="mt-3 font-display-lg text-display-lg font-bold text-secondary tracking-tight">{isLoading || !metrics || metrics.task_total === 0 ? "0%" : `${Math.round((metrics.completed_tasks / metrics.task_total) * 100)}%`}</div>
          </div>}
        </div>

        <section className="mb-space-lg rounded-xl bg-surface-container-lowest p-space-md shadow-sm" aria-labelledby="deadlines-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="deadlines-heading" className="font-headline-md text-headline-md font-bold text-on-surface">Upcoming deadlines</h2>
              <p className="text-sm text-on-surface-variant">Tasks, milestones, and project or team assignments due within the next three days.</p>
            </div>
            {(metrics?.upcoming_deadlines.length ?? 0) > 5 && (
              <button type="button" onClick={() => setShowAllDeadlines((show) => !show)} className="text-sm font-semibold text-primary hover:underline">
                {showAllDeadlines ? "Show less" : `View all (${metrics?.upcoming_deadlines.length ?? 0})`}
              </button>
            )}
          </div>
          {isLoading ? <p className="py-3 text-sm text-on-surface-variant">Loading deadlines…</p> : !metrics?.upcoming_deadlines?.length ? (
            <p className="py-3 text-sm text-on-surface-variant">No upcoming deadlines or assignment end dates.</p>
          ) : (
            <ul className="divide-y divide-outline-variant/40">
              {(showAllDeadlines ? metrics.upcoming_deadlines : metrics.upcoming_deadlines.slice(0, 5)).map((deadline) => (
                <li key={deadline.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <Link href={`/projects/${deadline.project_id}`} className="font-medium text-on-surface hover:text-primary">{deadline.title}</Link>
                    <p className="text-xs text-on-surface-variant">{deadline.project_name} · {deadline.kind}{deadline.critical ? " · Critical" : ""}</p>
                  </div>
                  <time dateTime={deadline.due_date} className={`shrink-0 text-sm font-semibold ${deadline.due_date < new Date().toISOString().slice(0, 10) ? "text-error" : "text-on-surface-variant"}`}>
                    {new Date(`${deadline.due_date}T00:00:00`).toLocaleDateString()}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          <div className="lg:col-span-8 flex flex-col gap-space-lg">
            {/* Project Health — real data */}
            <div className="p-space-md rounded-xl bg-surface-container-lowest shadow-sm">
              <div className="pb-space-md flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Recently created projects</h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Your latest four projects.
                </p>
                </div>
                <Link href="/projects" className="shrink-0 text-sm font-semibold text-primary hover:underline">View projects</Link>
              </div>
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
                        <td colSpan={4} className="py-6 px-3 text-on-surface-variant">
                          Loading...
                        </td>
                      </tr>
                    ) : projects.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 px-3 text-on-surface-variant">
                          No projects yet.
                        </td>
                      </tr>
                    ) : (
                      projects.slice(0, 4).map((p) => {
                        const badge = HEALTH_BADGE[p.maturity];
                        return (
                          <tr key={p.id} className="hover:bg-surface-container-low/60 transition-colors">
                            <td className="py-3 px-3 font-title-sm text-title-sm font-semibold text-on-surface">
                              <Link href={`/projects/${p.id}`} className="hover:text-primary">{p.name}</Link>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap text-on-surface font-medium">
                              {p.owner.full_name || p.owner.email}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap capitalize text-on-surface-variant">
                              {p.priority}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${badge.className}`}
                              >
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

            {!isMember && <div className="p-space-md rounded-xl bg-surface-container-lowest shadow-sm">
              <div className="pb-space-md flex items-center gap-space-sm">
                <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Task Overview</h2>
              </div>
              <p className="text-sm text-on-surface-variant">{metrics?.completed_tasks ?? 0} of {metrics?.task_total ?? 0} tasks completed.</p>
            </div>}
          </div>

          <div className="lg:col-span-4 flex flex-col gap-space-lg">
            <div className="p-space-md rounded-xl bg-surface-container-lowest shadow-sm">
              <div className="pb-space-sm flex items-center gap-2">
                <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Active Tickets</h2>
              </div>
              <div className="space-y-space-sm mt-1">
                <Link href="/blockers" aria-label={`View active tickets: ${metrics?.open_tickets ?? 0} tickets need attention`} className="block rounded-lg bg-error-container/40 p-3 transition hover:bg-error-container/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error">
                  <p className="text-sm font-medium text-on-error-container">{metrics?.open_tickets ?? 0} tickets need attention</p>
                  <p className="mt-1 text-xs text-on-error-container/80">Live from the ticket register</p>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth permission="dashboards:view">
      <DashboardContent />
    </RequireAuth>
  );
}
