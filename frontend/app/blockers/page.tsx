"use client";

import { useCallback, useEffect, useState, type SubmitEventHandler } from "react";
import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";
import { Dialog } from "@/components/dialog";
import { ApiError } from "@/lib/api-client";
import { assignBlocker, createBlocker, listBlockers, updateBlockerStatus } from "@/lib/blockers-api";
import { listTicketAssignees, listProjects } from "@/lib/projects-api";
import { listTasks } from "@/lib/work-api";
import { useAuth } from "@/lib/auth-context";
import type { BlockerOut } from "@/types/blockers";
import type { ContributorOut, ProjectListItemOut } from "@/types/projects";
import type { Task } from "@/types/work";

function BlockersContent() {
    const { hasPermission } = useAuth();
    const [blockers, setBlockers] = useState<BlockerOut[]>([]);
    const [page, setPage] = useState(1);
    const [pageCount, setPageCount] = useState(0);
    const [blockerTotal, setBlockerTotal] = useState(0);
    const [projects, setProjects] = useState<ProjectListItemOut[]>([]);
    const [projectId, setProjectId] = useState("");
    const [taskId, setTaskId] = useState("");
    const [projectTasks, setProjectTasks] = useState<Task[]>([]);
    const [assigneeId, setAssigneeId] = useState("");
    const [projectMembers, setProjectMembers] = useState<Record<string, ContributorOut[]>>({});
    const [assignmentTicket, setAssignmentTicket] = useState<BlockerOut | null>(null);
    const [assignmentAssigneeId, setAssignmentAssigneeId] = useState("");
    const [isSavingAssignee, setIsSavingAssignee] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const canAssign = hasPermission("blockers:raise") || hasPermission("blockers:manage");
    const canReassign = hasPermission("tasks:assign");

    const load = useCallback(async (requestedPage = page) => {
        try {
            const [blockerData, projectData] = await Promise.all([listBlockers(requestedPage), listProjects()]);
            setBlockers(blockerData.items);
            setPage(blockerData.page);
            setPageCount(blockerData.pages);
            setBlockerTotal(blockerData.total);
            setProjects(projectData);
            if (!projectId && projectData[0]) setProjectId(projectData[0].id);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Failed to load tickets.");
        }
    }, [page, projectId]);

    useEffect(() => {
        let cancelled = false;
        if (!projectId) {
            return () => { cancelled = true; };
        }
        void listTasks({ project_id: projectId })
            .then((response) => { if (!cancelled) setProjectTasks(response.items); })
            .catch(() => { if (!cancelled) setProjectTasks([]); });
        return () => { cancelled = true; };
    }, [projectId]);

    useEffect(() => {
        if (!canAssign || !projectId) return;
        let cancelled = false;
        void listTicketAssignees(projectId)
            .then((members) => {
                if (!cancelled) setProjectMembers((current) => ({ ...current, [projectId]: members }));
            })
            .catch((err) => {
                if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load project members.");
            });
        return () => { cancelled = true; };
    }, [projectId, canAssign]);

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
            await createBlocker({ project_id: projectId, task_id: taskId || undefined, title, description: description || undefined, assignee_id: assigneeId || undefined });
            setTitle("");
            setDescription("");
            setAssigneeId("");
            setTaskId("");
            await load(1);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Failed to raise ticket.");
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
            setError(err instanceof ApiError ? err.message : "Failed to update ticket.");
        }
    }

    async function openAssignment(blocker: BlockerOut) {
        setError(null);
        try {
            let members = projectMembers[blocker.project_id];
            if (!members) {
                members = await listTicketAssignees(blocker.project_id);
                setProjectMembers((current) => ({ ...current, [blocker.project_id]: members }));
            }
            setAssignmentAssigneeId(blocker.assignee_id || "");
            setAssignmentTicket(blocker);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Could not load project members.");
        }
    }

    async function changeAssignee() {
        if (!assignmentTicket) return;
        setIsSavingAssignee(true);
        setError(null);
        try {
            const updated = await assignBlocker(assignmentTicket.id, assignmentAssigneeId || null);
            setBlockers((current) => current.map((blocker) => blocker.id === updated.id ? updated : blocker));
            setAssignmentTicket(null);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Failed to assign ticket.");
        } finally {
            setIsSavingAssignee(false);
        }
    }

    return (
        <AppShell active="blockers" breadcrumb="Tickets">
            <div className="max-w-5xl px-4 sm:px-gutter-lg py-space-lg">
                <div className="mb-6">
                    <h1 className="font-headline-xl text-headline-xl font-bold text-on-surface">Raise Ticket</h1>
                    <p className="mt-1 font-body-md text-body-md text-on-surface-variant">Raise obstacles against projects and track their resolution.</p>
                </div>
                {error && <p className="mb-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{error}</p>}
                {(hasPermission("blockers:raise") || hasPermission("blockers:manage")) && (
                    <form onSubmit={handleCreate} className="mb-6 rounded-xl bg-surface-container-lowest p-5 shadow-sm">
                        <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Raise a Ticket</h2>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <select required value={projectId} onChange={(event) => { setProjectId(event.target.value); setTaskId(""); setProjectTasks([]); }} className="rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none">
                                <option value="">Select project</option>
                                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                            </select>
                            <select value={taskId} onChange={(event) => setTaskId(event.target.value)} disabled={!projectId || projectTasks.length === 0} className="rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none disabled:opacity-60">
                                <option value="">Project-level ticket (no task)</option>
                                {projectTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
                            </select>
                            {canAssign && <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className="rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none">
                                <option value="">Unassigned</option>
                                {(projectMembers[projectId] || []).map((member) => <option key={member.user_id} value={member.user_id}>{member.full_name || member.email}</option>)}
                            </select>}
                            <input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ticket title" className="rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none" />
                        </div>
                        <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Description" rows={3} className="mt-3 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none" />
                        <button type="submit" disabled={isSubmitting || !projectId} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-50">{isSubmitting ? "Saving..." : "Raise"}</button>
                    </form>
                )}
                <div className="space-y-3">
                    {blockerTotal === 0 ? <p className="rounded-xl bg-surface-container-lowest p-6 text-sm text-on-surface-variant">No tickets reported.</p> : blockers.map((blocker) => (
                        <article key={blocker.id} className="rounded-xl bg-surface-container-lowest p-5 shadow-sm">
                            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2"><h2 className="font-title-md text-title-md font-semibold text-on-surface">{blocker.title}</h2><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${blocker.status === "open" ? "bg-error-container text-on-error-container" : "bg-secondary-container/60 text-on-secondary-container"}`}>{blocker.status}</span></div>
                                    <p className="mt-1 text-sm text-secondary">{blocker.project_name}</p>
                                    {blocker.task_title && <p className="mt-1 text-xs text-on-surface-variant">Task: {blocker.task_title}</p>}
                                    {blocker.description && <p className="mt-2 text-sm text-on-surface-variant">{blocker.description}</p>}
                                    <p className="mt-3 text-xs text-outline">Raised by {blocker.raised_by_email} on {new Date(blocker.created_at).toLocaleString()}</p>
                                    <p className="mt-2 text-xs text-outline">Assigned to {blocker.assignee_email || "Unassigned"}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {canReassign && <button type="button" onClick={() => void openAssignment(blocker)} className="rounded-lg border border-outline-variant px-3 py-1.5 text-sm text-on-surface hover:border-secondary hover:text-secondary">Assign</button>}
                                    {blocker.status === "open" && hasPermission("blockers:manage") && <button type="button" onClick={() => void resolveBlocker(blocker.id)} className="rounded-lg border border-outline-variant px-3 py-1.5 text-sm text-on-surface hover:border-secondary hover:text-secondary">Mark resolved</button>}
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
                {pageCount > 1 && <div className="mt-5 flex items-center justify-between gap-3 text-sm text-on-surface-variant">
                    <span>{blockerTotal} tickets · Page {page} of {pageCount}</span>
                    <div className="flex gap-2">
                        <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-outline-variant px-3 py-1.5 disabled:opacity-50">Previous</button>
                        <button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="rounded-lg border border-outline-variant px-3 py-1.5 disabled:opacity-50">Next</button>
                    </div>
                </div>}
                {assignmentTicket && <Dialog title="Assign ticket" description={`${assignmentTicket.title} · ${assignmentTicket.project_name}`} onClose={() => !isSavingAssignee && setAssignmentTicket(null)}>
                    <label className="block text-sm font-medium text-on-surface">Project member
                        <select value={assignmentAssigneeId} onChange={(event) => setAssignmentAssigneeId(event.target.value)} className="mt-2 w-full rounded-lg border border-outline-variant px-3 py-2">
                            <option value="">Unassigned</option>
                            {(projectMembers[assignmentTicket.project_id] || []).map((member) => <option key={member.user_id} value={member.user_id}>{member.full_name || member.email}</option>)}
                        </select>
                    </label>
                    <div className="mt-5 flex justify-end gap-2">
                        <button type="button" disabled={isSavingAssignee} onClick={() => setAssignmentTicket(null)} className="rounded-lg border border-outline-variant px-4 py-2 text-sm">Cancel</button>
                        <button type="button" disabled={isSavingAssignee} onClick={() => void changeAssignee()} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-50">{isSavingAssignee ? "Saving..." : "Save assignment"}</button>
                    </div>
                </Dialog>}
            </div>
        </AppShell>
    );
}

export default function BlockersPage() {
    return <RequireAuth anyPermissions={["projects:view", "projects:view_assigned"]}><BlockersContent /></RequireAuth>;
}
