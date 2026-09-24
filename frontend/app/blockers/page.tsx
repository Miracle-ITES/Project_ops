"use client";

import { useCallback, useEffect, useState, type SubmitEventHandler } from "react";
import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";
import { ApiError } from "@/lib/api-client";
import { createBlocker, listBlockers, updateBlockerStatus } from "@/lib/blockers-api";
import { listProjects } from "@/lib/projects-api";
import { useAuth } from "@/lib/auth-context";
import type { BlockerOut } from "@/types/blockers";
import type { ProjectListItemOut } from "@/types/projects";

function BlockersContent() {
    const { hasPermission } = useAuth();
    const [blockers, setBlockers] = useState<BlockerOut[]>([]);
    const [projects, setProjects] = useState<ProjectListItemOut[]>([]);
    const [projectId, setProjectId] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const load = useCallback(async () => {
        try {
            const [blockerData, projectData] = await Promise.all([listBlockers(), listProjects()]);
            setBlockers(blockerData);
            setProjects(projectData);
            if (!projectId && projectData[0]) setProjectId(projectData[0].id);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Failed to load blockers.");
        }
    }, [projectId]);

    useEffect(() => {
        let cancelled = false;
        queueMicrotask(() => {
            if (!cancelled) void load();
        });
        return () => {
            cancelled = true;
        };
    }, [load]);

    const handleCreate: SubmitEventHandler<HTMLFormElement> = async (event) => {
        event.preventDefault();
        if (!projectId || !title) return;
        setError(null);
        setIsSubmitting(true);
        try {
            await createBlocker({ project_id: projectId, title, description: description || undefined });
            setTitle("");
            setDescription("");
            await load();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Failed to raise blocker.");
        } finally {
            setIsSubmitting(false);
        }
    };

    async function resolveBlocker(blockerId: string) {
        setError(null);
        try {
            const updated = await updateBlockerStatus(blockerId, "resolved");
            setBlockers((current) => current.map((blocker) => blocker.id === updated.id ? updated : blocker));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Failed to update blocker.");
        }
    }

    return (
        <AppShell active="blockers" breadcrumb="Blockers">
            <div className="max-w-5xl px-gutter-lg py-space-lg">
                <div className="mb-6">
                    <h1 className="font-headline-xl text-headline-xl font-bold text-on-surface">Blockers</h1>
                    <p className="mt-1 font-body-md text-body-md text-on-surface-variant">Raise obstacles against projects and track their resolution.</p>
                </div>
                {error && <p className="mb-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{error}</p>}
                {hasPermission("blockers:raise") && (
                    <form onSubmit={handleCreate} className="mb-6 rounded-xl bg-surface-container-lowest p-5 shadow-sm">
                        <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Raise a blocker</h2>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <select required value={projectId} onChange={(event) => setProjectId(event.target.value)} className="rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none">
                                <option value="">Select project</option>
                                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                            </select>
                            <input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Blocker title" className="rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none" />
                        </div>
                        <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What is blocking progress?" rows={3} className="mt-3 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none" />
                        <button type="submit" disabled={isSubmitting || !projectId} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-50">{isSubmitting ? "Saving..." : "Raise blocker"}</button>
                    </form>
                )}
                <div className="space-y-3">
                    {blockers.length === 0 ? <p className="rounded-xl bg-surface-container-lowest p-6 text-sm text-on-surface-variant">No blockers reported.</p> : blockers.map((blocker) => (
                        <article key={blocker.id} className="rounded-xl bg-surface-container-lowest p-5 shadow-sm">
                            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2"><h2 className="font-title-md text-title-md font-semibold text-on-surface">{blocker.title}</h2><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${blocker.status === "open" ? "bg-error-container text-on-error-container" : "bg-secondary-container/60 text-on-secondary-container"}`}>{blocker.status}</span></div>
                                    <p className="mt-1 text-sm text-secondary">{blocker.project_name}</p>
                                    {blocker.description && <p className="mt-2 text-sm text-on-surface-variant">{blocker.description}</p>}
                                    <p className="mt-3 text-xs text-outline">Raised by {blocker.raised_by_email} on {new Date(blocker.created_at).toLocaleString()}</p>
                                </div>
                                {blocker.status === "open" && hasPermission("blockers:manage") && <button type="button" onClick={() => void resolveBlocker(blocker.id)} className="rounded-lg border border-outline-variant px-3 py-1.5 text-sm text-on-surface hover:border-secondary hover:text-secondary">Mark resolved</button>}
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </AppShell>
    );
}

export default function BlockersPage() {
    return <RequireAuth permission="projects:view"><BlockersContent /></RequireAuth>;
}
