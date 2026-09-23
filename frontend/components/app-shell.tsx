"use client";

import Link from "next/link";
import { Activity, CheckSquare, FolderOpen, LayoutDashboard, Sparkles, UsersRound, TriangleAlert, ChevronRight, UserCog } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export type NavKey = "dashboard" | "projects" | "team" | "users";

const NAV_ITEMS: { key: NavKey | "disabled"; label: string; icon: typeof LayoutDashboard; href?: string; permission?: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { key: "projects", label: "Projects", icon: FolderOpen, href: "/projects" },
  { key: "disabled", label: "Tasks", icon: CheckSquare },
  { key: "team", label: "Team", icon: UsersRound, href: "/teams" },
  { key: "users", label: "Users", icon: UserCog, href: "/users", permission: "users:manage" },
  { key: "disabled", label: "Blockers", icon: TriangleAlert },
  { key: "disabled", label: "Activity", icon: Activity },
  { key: "disabled", label: "AI Assistant", icon: Sparkles },
];

interface AppShellProps {
  active: NavKey;
  breadcrumb: string;
  children: React.ReactNode;
}

export function AppShell({ active, breadcrumb, children }: AppShellProps) {
  const { user, logout, hasPermission } = useAuth();
  const initials = (user?.full_name || user?.email || "?").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-surface">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-surface-container-lowest z-50 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col flex-1 min-h-0">
          <div className="h-14 px-space-md flex items-center gap-space-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-on-primary font-bold text-sm">
              PO
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-space-xs">
                <span className="font-title-sm text-title-sm text-on-surface font-bold truncate leading-none">
                  Project Ops
                </span>
              </div>
              <span className="font-body-sm text-[11px] text-on-surface-variant truncate leading-none mt-1">
                Run. Align. Move.
              </span>
            </div>
          </div>

          <div className="px-space-md pt-space-xs pb-space-xxs">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline px-space-sm">
              Operations
            </span>
          </div>

          <nav className="flex-1 px-space-md space-y-space-xxs overflow-y-auto">
            {NAV_ITEMS.map((item) => {
              if (item.permission && !hasPermission(item.permission)) return null;
              const isActive = item.key === active;
              const Icon = item.icon;
              const className = isActive
                ? "flex items-center gap-space-sm px-space-sm py-2 rounded-lg transition-colors bg-surface-container-low text-primary font-semibold relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:bg-secondary before:rounded-r"
                : "flex items-center gap-space-sm px-space-sm py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors";

              if (!item.href) {
                // Nav items with no backend yet (Tasks, Blockers, Activity,
                // AI Assistant) — present for visual parity with the
                // design, but not wired to anything real.
                return (
                  <span
                    key={item.label}
                    title="Coming soon"
                    className={`${className} cursor-not-allowed opacity-50`}
                  >
                    <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                    <span className="font-label-md text-label-md">{item.label}</span>
                  </span>
                );
              }

              return (
                <Link key={item.label} href={item.href} className={className}>
                  <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
                  <span className="font-label-md text-label-md">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-space-md">
          <div className="flex items-center justify-between p-space-sm rounded-lg bg-surface-container-low">
            <div className="flex items-center gap-space-sm min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-label-sm text-[11px] font-bold shrink-0">
                {initials}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-label-md text-label-md font-semibold text-on-surface truncate leading-tight">
                  {user?.full_name || user?.email}
                </span>
                <span className="font-body-sm text-[11px] text-on-surface-variant truncate">
                  {user?.role.name}
                </span>
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="font-label-sm text-label-sm text-on-surface-variant hover:text-error shrink-0"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Header */}
      <header className="fixed top-0 left-64 right-0 h-14 bg-surface-container-lowest/90 backdrop-blur-xl z-40 px-gutter-lg flex items-center justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-space-xs text-on-surface-variant font-label-md text-label-md">
          <span className="hover:text-on-surface cursor-pointer">Operations</span>
          <ChevronRight size={16} className="text-outline" aria-hidden="true" />
          <span className="font-semibold text-on-surface">{breadcrumb}</span>
        </div>
      </header>

      {/* Content */}
      <main className="pl-64 pt-14 min-h-screen">{children}</main>
    </div>
  );
}
