"use client";

import { useEffect, useState } from "react";
import { Activity as ActivityIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";
import { ApiError } from "@/lib/api-client";
import { listActivity } from "@/lib/activity-api";
import type { ActivityOut } from "@/types/activity";

function ActivityContent() {
    const [entries, setEntries] = useState<ActivityOut[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        void listActivity().then(setEntries).catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load activity."));
    }, []);

    return (
        <AppShell active="activity" breadcrumb="Activity">
            <div className="max-w-5xl px-gutter-lg py-space-lg">
                <div className="mb-6">
                    <h1 className="font-headline-xl text-headline-xl font-bold text-on-surface">Activity</h1>
                    <p className="mt-1 font-body-md text-body-md text-on-surface-variant">Recent authentication, security, and administrative events.</p>
                </div>
                {error && <p className="mb-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{error}</p>}
                <div className="overflow-x-auto rounded-xl bg-surface-container-lowest p-4 shadow-sm">
                    {entries.length === 0 && !error ? <p className="p-4 text-sm text-on-surface-variant">No activity recorded yet.</p> : (
                        <table className="w-full min-w-180 text-left text-sm">
                            <thead><tr className="border-b border-outline-variant/40 text-xs uppercase tracking-wider text-outline"><th className="px-3 py-3">Event</th><th className="px-3 py-3">User</th><th className="px-3 py-3">Details</th><th className="px-3 py-3">When</th></tr></thead>
                            <tbody>{entries.map((entry) => <tr key={entry.id} className="border-b border-outline-variant/30 last:border-0"><td className="px-3 py-3"><span className="inline-flex items-center gap-2 font-semibold text-on-surface"><ActivityIcon size={16} className="text-secondary" />{entry.action}</span></td><td className="px-3 py-3 text-on-surface-variant">{entry.user_email || "System"}</td><td className="px-3 py-3 text-on-surface-variant">{entry.detail || "-"}</td><td className="whitespace-nowrap px-3 py-3 text-xs text-outline">{new Date(entry.created_at).toLocaleString()}</td></tr>)}</tbody>
                        </table>
                    )}
                </div>
            </div>
        </AppShell>
    );
}

export default function ActivityPage() {
    return <RequireAuth permission="audit:view"><ActivityContent /></RequireAuth>;
}
