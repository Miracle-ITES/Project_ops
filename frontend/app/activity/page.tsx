"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity as ActivityIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";
import { ApiError } from "@/lib/api-client";
import { listActivity } from "@/lib/activity-api";
import type { ActivityOut } from "@/types/activity";

function formatEventName(action: string): string {
    const issueEventNames: Record<string, string> = {
        issue_created: "Issue Reported",
        issue_updated: "Issue Updated",
        issue_escalated: "Issue Escalated to Ticket",
    };
    if (issueEventNames[action]) return issueEventNames[action];
    return action
        .split("_")
        .filter(Boolean)
        .map((part) => {
            const normalized = part.toLowerCase() === "blocker" ? "ticket" : part.toLowerCase() === "blockers" ? "tickets" : part;
            return normalized.charAt(0).toUpperCase() + normalized.slice(1);
        })
        .join(" ");
}

function formatActivityDetail(detail: string): string {
    return detail.replace(/\bblockers?\b/gi, (word) => {
        const replacement = word.toLowerCase() === "blockers" ? "tickets" : "ticket";
        return word[0] === word[0].toUpperCase()
            ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
            : replacement;
    });
}

function ActivityContent() {
    const [entries, setEntries] = useState<ActivityOut[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [actionFilter, setActionFilter] = useState("all");
    const [dateFilter, setDateFilter] = useState("all");
    const [showAll, setShowAll] = useState(false);

    useEffect(() => {
        void listActivity()
            .then(setEntries)
            .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load activity."))
            .finally(() => setIsLoading(false));
    }, []);

    const actions = useMemo(() => Array.from(new Set(entries.map((entry) => entry.action))).sort(), [entries]);
    const filteredEntries = useMemo(() => {
        const query = search.trim().toLowerCase();
        const now = new Date();
        const cutoff = dateFilter === "today"
            ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
            : dateFilter === "7days" ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                : dateFilter === "30days" ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) : null;
        return entries.filter((entry) => {
            const matchesSearch = !query || [entry.action, entry.user_email, entry.detail]
                .some((value) => value?.toLowerCase().includes(query));
            const matchesAction = actionFilter === "all" || entry.action === actionFilter;
            const matchesDate = !cutoff || new Date(entry.created_at) >= cutoff;
            return matchesSearch && matchesAction && matchesDate;
        });
    }, [entries, search, actionFilter, dateFilter]);
    const visibleEntries = showAll ? filteredEntries : filteredEntries.slice(0, 10);

    return (
        <AppShell active="activity" breadcrumb="Activity">
            <div className="max-w-5xl px-gutter-lg py-space-lg">
                <div className="mb-6">
                    <h1 className="font-headline-xl text-headline-xl font-bold text-on-surface">Activity</h1>
                    <p className="mt-1 font-body-md text-body-md text-on-surface-variant">Recent authentication, security, issue, and administrative events.</p>
                </div>
                {error && <p className="mb-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{error}</p>}
                <div className="overflow-x-auto rounded-xl bg-surface-container-lowest p-4 shadow-sm">
                    <div className="mb-4 flex flex-col gap-3 md:flex-row">
                        <label className="flex-1 text-xs font-semibold text-outline">Search activity
                            <input value={search} onChange={(event) => { setSearch(event.target.value); setShowAll(false); }} placeholder="Search event, user, or details" className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm font-normal text-on-surface focus:border-secondary focus:outline-none" />
                        </label>
                        <label className="text-xs font-semibold text-outline">Event type
                            <select value={actionFilter} onChange={(event) => { setActionFilter(event.target.value); setShowAll(false); }} className="mt-1 block w-full rounded-lg border border-outline-variant px-3 py-2 text-sm font-normal text-on-surface focus:border-secondary focus:outline-none">
                                <option value="all">All events</option>
                                {actions.map((action) => <option key={action} value={action}>{formatEventName(action)}</option>)}
                            </select>
                        </label>
                        <label className="text-xs font-semibold text-outline">Date range
                            <select value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setShowAll(false); }} className="mt-1 block w-full rounded-lg border border-outline-variant px-3 py-2 text-sm font-normal text-on-surface focus:border-secondary focus:outline-none">
                                <option value="all">Any time</option>
                                <option value="today">Today</option>
                                <option value="7days">Last 7 days</option>
                                <option value="30days">Last 30 days</option>
                            </select>
                        </label>
                    </div>
                    {isLoading ? <p className="p-4 text-sm text-on-surface-variant">Loading activity...</p>
                    : filteredEntries.length === 0 ? <p className="p-4 text-sm text-on-surface-variant">{entries.length ? "No activity matches these filters." : "No activity recorded yet."}</p> : (
                        <table className="w-full min-w-180 text-left text-sm">
                            <thead><tr className="border-b border-outline-variant/40 text-xs uppercase tracking-wider text-outline"><th className="px-3 py-3">Event</th><th className="px-3 py-3">User</th><th className="px-3 py-3">Details</th><th className="px-3 py-3">When</th></tr></thead>
                            <tbody>{visibleEntries.map((entry) => <tr key={entry.id} className="border-b border-outline-variant/30 last:border-0"><td className="px-3 py-3"><span className="inline-flex items-center gap-2 font-semibold text-on-surface"><ActivityIcon size={16} className="text-secondary" />{formatEventName(entry.action)}</span></td><td className="px-3 py-3 text-on-surface-variant">{entry.user_email || "System"}</td><td className="px-3 py-3 text-on-surface-variant">{entry.detail ? formatActivityDetail(entry.detail) : "-"}</td><td className="whitespace-nowrap px-3 py-3 text-xs text-outline">{new Date(entry.created_at).toLocaleString()}</td></tr>)}</tbody>
                        </table>
                    )}
                    {filteredEntries.length > 10 && <div className="mt-4 flex justify-center">
                        <button type="button" onClick={() => setShowAll((current) => !current)} className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:border-secondary hover:text-secondary">
                            {showAll ? "Show recent" : `View all ${filteredEntries.length} events`}
                        </button>
                    </div>}
                </div>
            </div>
        </AppShell>
    );
}

export default function ActivityPage() {
    return <RequireAuth permission="audit:view"><ActivityContent /></RequireAuth>;
}
