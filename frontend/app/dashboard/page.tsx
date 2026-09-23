"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { listProjects } from "@/lib/projects-api";
import type { ProjectListItemOut, ProjectMaturity } from "@/types/projects";

const HEALTH_BADGE: Record<ProjectMaturity, { text: string; dot: string; className: string }> = {
  planning: { text: "Planning", dot: "bg-outline", className: "bg-surface-container-high text-on-surface-variant" },
  active: { text: "Healthy", dot: "bg-secondary", className: "bg-secondary-container/60 text-on-secondary-container" },
  at_risk: { text: "At Risk", dot: "bg-amber-600", className: "bg-amber-100 text-amber-900" },
  blocked: { text: "Blocked", dot: "bg-error", className: "bg-error-container text-on-error-container" },
  completed: { text: "Completed", dot: "bg-secondary", className: "bg-secondary-container/60 text-on-secondary-container" },
};

function DashboardContent() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectListItemOut[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .finally(() => setIsLoading(false));
  }, []);

  const firstName = (user?.full_name || user?.email || "").split(/[\s@]/)[0];

  return (
    <AppShell active="dashboard" breadcrumb="Executive Overview">
      <div className="px-gutter-lg py-space-lg">
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
        </div>

        {/* KPI cards — Active Projects is real; the rest have no backend
            yet (Tasks, Blockers, Team Progress) so they stay static. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md mb-space-lg">
          <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm">
            <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold text-outline">
              Active Projects
            </span>
            <div className="mt-3 font-display-lg text-display-lg font-bold text-on-surface tracking-tight">
              {isLoading ? "…" : projects.length}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm">
            <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold text-outline">
              Tasks Due Today
            </span>
            <div className="mt-3 font-display-lg text-display-lg font-bold text-on-surface tracking-tight">34</div>
            <p className="mt-3 font-body-sm text-body-sm text-on-surface-variant">Placeholder — no Tasks module yet</p>
          </div>
          <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm">
            <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold text-outline">
              Open Blockers
            </span>
            <div className="mt-3 font-display-lg text-display-lg font-bold text-error tracking-tight">4</div>
            <p className="mt-3 font-body-sm text-body-sm text-on-surface-variant">Placeholder — no Blockers module yet</p>
          </div>
          <div className="p-4 rounded-xl bg-surface-container-lowest shadow-sm">
            <span className="font-label-sm text-label-sm uppercase tracking-wider font-semibold text-outline">
              Team Progress
            </span>
            <div className="mt-3 font-display-lg text-display-lg font-bold text-secondary tracking-tight">86%</div>
            <p className="mt-3 font-body-sm text-body-sm text-on-surface-variant">Placeholder — no progress metric yet</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
          <div className="lg:col-span-8 flex flex-col gap-space-lg">
            {/* Project Health — real data */}
            <div className="p-space-md rounded-xl bg-surface-container-lowest shadow-sm">
              <div className="pb-space-md">
                <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Project Health</h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Live from your Projects data
                </p>
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
                      projects.slice(0, 6).map((p) => {
                        const badge = HEALTH_BADGE[p.maturity];
                        return (
                          <tr key={p.id} className="hover:bg-surface-container-low/60 transition-colors">
                            <td className="py-3 px-3 font-title-sm text-title-sm font-semibold text-on-surface">
                              {p.name}
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

            {/* Task Overview — static, no Tasks backend yet */}
            <div className="p-space-md rounded-xl bg-surface-container-lowest shadow-sm">
              <div className="pb-space-md flex items-center gap-space-sm">
                <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Task Overview</h2>
                <span className="px-2 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant font-code-sm text-code-sm">
                  Static preview — no Tasks module yet
                </span>
              </div>
              <div className="space-y-3">
                {[
                  { title: "Complete dashboard UI", status: "In Progress" },
                  { title: "Connect project API", status: "To Do" },
                  { title: "Fix authentication flow", status: "Completed" },
                ].map((task) => (
                  <div
                    key={task.title}
                    className="flex items-center justify-between rounded-lg bg-surface-container-low/60 p-4"
                  >
                    <span className="text-sm font-medium text-on-surface">{task.title}</span>
                    <span className="text-xs text-on-surface-variant">{task.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-space-lg">
            {/* Active Blockers — static, no Blockers backend yet */}
            <div className="p-space-md rounded-xl bg-surface-container-lowest shadow-sm">
              <div className="pb-space-sm flex items-center gap-2">
                <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Active Blockers</h2>
                <span className="px-2 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant font-code-sm text-code-sm">
                  Static preview
                </span>
              </div>
              <div className="space-y-space-sm mt-1">
                <div className="p-3 rounded-lg bg-error-container/40">
                  <p className="text-sm font-medium text-on-error-container">Authentication API integration</p>
                  <p className="mt-1 text-xs text-on-error-container/80">Waiting for backend endpoint</p>
                </div>
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
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
