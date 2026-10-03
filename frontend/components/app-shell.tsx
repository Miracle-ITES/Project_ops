"use client";

import Link from "next/link";
import { Activity, CheckSquare, FolderOpen, LayoutDashboard, Sparkles, UsersRound, TriangleAlert, ChevronRight, UserCog, CircleAlert, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { updateMyProfile } from "@/lib/users-api";
import { ApiError } from "@/lib/api-client";
import { useState, type FormEvent } from "react";

export type NavKey = "dashboard" | "projects" | "tasks" | "updates" | "team" | "users" | "blockers" | "issues" | "activity";

const NAV_ITEMS: { key: NavKey | "disabled"; label: string; icon: typeof LayoutDashboard; href?: string; permission?: string; anyPermissions?: string[] }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { key: "projects", label: "Projects", icon: FolderOpen, href: "/projects" },
  { key: "tasks", label: "Tasks", icon: CheckSquare, href: "/tasks" },
  { key: "updates", label: "Updates", icon: Sparkles, href: "/updates" },
  { key: "team", label: "Team", icon: UsersRound, href: "/teams", anyPermissions: ["teams:manage", "project_teams:manage", "projects:view", "teams:view_own_roster"] },
  { key: "users", label: "Users", icon: UserCog, href: "/users", anyPermissions: ["users:request", "teams:view_own_roster"] },
  { key: "blockers", label: "Raise Ticket", icon: TriangleAlert, href: "/blockers", anyPermissions: ["projects:view", "projects:view_assigned"] },
  { key: "issues", label: "Issues", icon: CircleAlert, href: "/issues", permission: "issues:view" },
  { key: "activity", label: "Activity", icon: Activity, href: "/activity", permission: "audit:view" },
  { key: "disabled", label: "AI Assistant", icon: Sparkles },
];

interface AppShellProps {
  active: NavKey;
  breadcrumb: string;
  children: React.ReactNode;
}

export function AppShell({ active, breadcrumb, children }: AppShellProps) {
  const { user, logout, refreshUser, hasPermission } = useAuth();
  const [profileName, setProfileName] = useState(user?.full_name || "");
  const [companyName, setCompanyName] = useState(user?.company_name || "");
  const [jobTitle, setJobTitle] = useState(user?.job_title || "");
  const [department, setDepartment] = useState(user?.department || "");
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || "");
  const [location, setLocation] = useState(user?.location || "");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const initials = (user?.full_name || user?.email || "?").slice(0, 2).toUpperCase();
  const visibleNavItems = NAV_ITEMS.filter((item) =>
    !(item.key === "users" && user?.role.name === "Member") &&
    (!item.permission || hasPermission(item.permission)) &&
    (!item.anyPermissions || item.anyPermissions.some(hasPermission)),
  );

  async function completeProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);
    setProfileSaving(true);
    try {
      await updateMyProfile({
        full_name: profileName, company_name: companyName, job_title: jobTitle,
        department, phone_number: phoneNumber, location,
      });
      await refreshUser();
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : "Could not save profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  if (user && !user.profile_completed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-6 sm:px-6 sm:py-8">
        <form onSubmit={completeProfile} className="w-full max-w-md rounded-xl bg-surface-container-lowest p-5 shadow-sm sm:p-8">
          <p className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-secondary">Welcome to Project Ops</p>
          <h1 className="mt-2 font-headline-xl text-headline-xl font-bold text-on-surface">Complete your profile</h1>
          <p className="mt-2 font-body-md text-body-md text-on-surface-variant">Complete your company profile. These details are locked after submission and can only be changed by an administrator.</p>
          {profileError && <p className="mt-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{profileError}</p>}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <input required minLength={1} value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Full name" className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none" />
            <input required value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Company name" className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none" />
            <input required value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="Job title" className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none" />
            <input value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="Department" className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none" />
            <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="Phone number" className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none" />
            <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location" className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none" />
          </div>
          <button type="submit" disabled={profileSaving} className="mt-4 w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-50">{profileSaving ? "Saving..." : "Save profile"}</button>
        </form>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 z-50 hidden w-64 flex-col justify-between bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] md:flex">
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
            {visibleNavItems.map((item) => {
              const isActive = item.key === active;
              const Icon = item.icon;
              const className = isActive
                ? "flex items-center gap-space-sm px-space-sm py-2 rounded-lg transition-colors bg-surface-container-low text-primary font-semibold relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:bg-secondary before:rounded-r"
                : "flex items-center gap-space-sm px-space-sm py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors";

              if (!item.href) {
                // Keep unfinished navigation visible without making it interactive.
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
              <Link href="/profile" className="flex flex-col min-w-0 hover:text-secondary">
                <span className="font-label-md text-label-md font-semibold text-on-surface truncate leading-tight">
                  {user?.full_name || user?.email}
                </span>
                <span className="font-body-sm text-[11px] text-on-surface-variant truncate">
                  {user?.role.name}
                </span>
              </Link>
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
      <header className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between bg-surface-container-lowest/90 px-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl sm:px-gutter-lg md:left-64">
        <div className="flex min-w-0 items-center gap-space-xs text-on-surface-variant font-label-md text-label-md">
          <span className="hidden sm:inline">Operations</span>
          <ChevronRight size={16} className="hidden shrink-0 text-outline sm:block" aria-hidden="true" />
          {active === "dashboard" ? (
            <span aria-label="Project Ops" title="Project Ops" className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-on-primary sm:hidden">PO</span>
          ) : (
            <span className="truncate font-semibold text-on-surface">{breadcrumb}</span>
          )}
          {active === "dashboard" && <span className="hidden font-semibold text-on-surface sm:inline">{breadcrumb}</span>}
        </div>
        <div className="ml-3 flex shrink-0 items-center gap-3 md:hidden">
          <Link href="/profile" aria-label="Open profile" className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-container text-xs font-bold text-on-primary">{initials}</Link>
          <button type="button" onClick={() => logout()} aria-label="Sign out" className="text-on-surface-variant hover:text-error"><LogOut size={19} /></button>
        </div>
      </header>

      <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-50 border-t border-outline-variant/60 bg-surface-container-lowest/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(0,0,0,0.06)] backdrop-blur-xl md:hidden">
        <div className="flex overflow-x-auto px-1 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visibleNavItems.map((item) => {
            if (!item.href) return null;
            const Icon = item.icon;
            const isActive = item.key === active;
            return <Link key={item.key} href={item.href} aria-current={isActive ? "page" : undefined} className={`flex min-w-[4.5rem] flex-1 flex-col items-center gap-1 rounded-lg px-2 py-1 text-[10px] leading-tight ${isActive ? "text-primary" : "text-on-surface-variant"}`}>
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} aria-hidden="true" />
              <span className="max-w-16 truncate">{item.label}</span>
            </Link>;
          })}
        </div>
      </nav>

      {/* Content */}
      <main className="min-h-screen min-w-0 pb-20 pt-14 md:pl-64 md:pb-0">{children}</main>
    </div>
  );
}
