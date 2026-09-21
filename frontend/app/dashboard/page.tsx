"use client";

import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth-context";

const projects = [
  { name: "Project Ops Platform", progress: 72, health: "Healthy" },
  { name: "Authentication Module", progress: 48, health: "At Risk" },
  { name: "AI Assistant", progress: 25, health: "Blocked" },
];

const tasks = [
  { title: "Complete dashboard UI", status: "In Progress" },
  { title: "Connect project API", status: "To Do" },
  { title: "Fix authentication flow", status: "Completed" },
];

function DashboardContent() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white px-8 py-4">
        <div className="mx-auto flex max-w-7xl items-center">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#34d399]/20 bg-[#033729] shadow-sm">
              <span className="text-lg font-bold text-emerald-300">
                PO
              </span>
            </div>

            
          </div>

          {/* Greeting */}
          <div className="ml-8">
            <h1 className="text-xl font-semibold text-gray-900">
              Good morning
            </h1>
            <p className="text-sm text-gray-500">
              Here&apos;s an overview of your team&apos;s work.
            </p>
          </div>

          {/* Sign out */}
          <button
            onClick={() => logout()}
            className="ml-auto rounded-lg border border-gray-200 bg-[#033729] px-4 py-2 text-sm font-medium text-emerald-300 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-6 p-8">
        {/* User */}
        <div>
          <p className="text-sm text-gray-500">
            Signed in as{" "}
            <span className="font-medium text-gray-900">
              {user?.email}
            </span>
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Active Projects</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">4</p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Tasks Due</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">12</p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Open Blockers</p>
            <p className="mt-2 text-3xl font-semibold text-red-600">2</p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Team Progress</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-600">
              72%
            </p>
          </div>
        </div>

        {/* Projects + Tasks */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Project Health */}
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-gray-900">
                Project Health
              </h2>
              <p className="text-sm text-gray-500">
                Current project progress
              </p>
            </div>

            <div className="space-y-5">
              {projects.map((project) => (
                <div key={project.name}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">
                      {project.name}
                    </span>

                    <span
                      className={`text-xs font-medium ${project.health === "Healthy"
                          ? "text-emerald-600"
                          : project.health === "At Risk"
                            ? "text-amber-600"
                            : "text-red-600"
                        }`}
                    >
                      {project.health}
                    </span>
                  </div>

                  <div className="h-2 rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>

                  <p className="mt-1 text-xs text-gray-400">
                    {project.progress}% complete
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Task Overview */}
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-gray-900">
                Task Overview
              </h2>
              <p className="text-sm text-gray-500">
                Recent tasks across your projects
              </p>
            </div>

            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.title}
                  className="flex items-center justify-between rounded-lg bg-gray-50 p-4"
                >
                  <span className="text-sm font-medium text-gray-800">
                    {task.title}
                  </span>

                  <span className="text-xs text-gray-500">
                    {task.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Blockers */}
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Active Blockers
            </h2>
            <p className="text-sm text-gray-500">
              Issues that need attention
            </p>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-red-100 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">
                Authentication API integration
              </p>
              <p className="mt-1 text-xs text-red-600">
                Waiting for backend endpoint
              </p>
            </div>

            <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-800">
                AI Assistant setup
              </p>
              <p className="mt-1 text-xs text-amber-600">
                LLM configuration pending
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}