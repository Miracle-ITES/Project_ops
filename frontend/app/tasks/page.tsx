"use client";

import { useEffect, useState } from "react";
import { CalendarDays, GripVertical, Plus, UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth-context";
import { listProjectMembers, listProjects } from "@/lib/projects-api";
import { createTask, deleteTask, listTaskAssignees, listTasks, updateTask } from "@/lib/work-api";
import { reportTaskIssue } from "@/lib/issues-api";
import { ApiError } from "@/lib/api-client";
import { Dialog } from "@/components/dialog";
import type { ContributorOut, ProjectListItemOut } from "@/types/projects";
import type { IssuePriority } from "@/types/issues";
import type { Task, TaskPriority, TaskStatus, UserBrief } from "@/types/work";

const columns: { status: TaskStatus; label: string }[] = [
    { status: "backlog", label: "To Do" },
    { status: "in_progress", label: "In Progress" },
    { status: "completed", label: "Completed" },
];
const priorityClass: Record<TaskPriority, string> = {
    low: "text-on-surface-variant",
    medium: "text-secondary",
    high: "text-amber-700",
    critical: "text-error",
};

function TasksContent() {
    const { user, hasPermission } = useAuth();
    const canCreateTasks = hasPermission("projects:create");
    const canAssignTasks = hasPermission("tasks:assign");
    const canUpdateAssignedTasks = hasPermission("status:update");
    const canRaiseIssues = hasPermission("issues:raise");
    const canFilterByUser = hasPermission("users:manage") || hasPermission("projects:create") || hasPermission("projects:view");
    const projectFilterLabel = hasPermission("users:manage")
        ? "All projects"
        : hasPermission("projects:create")
            ? "All my projects"
            : hasPermission("projects:view_assigned")
                ? "All assigned projects"
                : "All projects";
    const [tasks, setTasks] = useState<Task[]>([]);
    const [projects, setProjects] = useState<ProjectListItemOut[]>([]);
    const [taskAssignees, setTaskAssignees] = useState<UserBrief[]>([]);
    const [projectMembers, setProjectMembers] = useState<Record<string, ContributorOut[]>>({});
    const [search, setSearch] = useState("");
    const [filterProjectId, setFilterProjectId] = useState("");
    const [filterAssigneeId, setFilterAssigneeId] = useState("");
    const [title, setTitle] = useState("");
    const [priority, setPriority] = useState<TaskPriority>("medium");
    const [projectId, setProjectId] = useState("");
    const [assigneeId, setAssigneeId] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);
    const [reportingTaskId, setReportingTaskId] = useState<string | null>(null);
    const [issueTitle, setIssueTitle] = useState("");
    const [issueDescription, setIssueDescription] = useState("");
    const [issueCategory, setIssueCategory] = useState("general");
    const [issuePriority, setIssuePriority] = useState<IssuePriority>("medium");
    const [issueSeverity, setIssueSeverity] = useState<IssuePriority>("medium");
    const [issueDueDate, setIssueDueDate] = useState("");
    const [issueError, setIssueError] = useState<string | null>(null);
    const [issueSaving, setIssueSaving] = useState(false);
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editTaskTitle, setEditTaskTitle] = useState("");
    const [editTaskDescription, setEditTaskDescription] = useState("");
    const [editTaskPriority, setEditTaskPriority] = useState<TaskPriority>("medium");
    const [editTaskDueDate, setEditTaskDueDate] = useState("");
    const [editTaskAssigneeId, setEditTaskAssigneeId] = useState("");
    useEffect(() => {
        void listTasks({
            search: search || undefined,
            project_id: filterProjectId || undefined,
            assignee_id: filterAssigneeId || undefined,
        })
            .then((page) => setTasks(page.items))
            .catch(() => setError("Could not load tasks."));
    }, [search, filterProjectId, filterAssigneeId]);
    useEffect(() => {
        void listProjects()
            .then(setProjects)
            .catch(() => setError("Could not load projects."));
    }, []);
    useEffect(() => {
        if (!canFilterByUser) return;
        void listTaskAssignees()
            .then(setTaskAssignees)
            .catch(() => setError("Could not load task assignees."));
    }, [canFilterByUser]);
    useEffect(() => {
        if (!canAssignTasks) return;
        const relevantProjectIds = [...new Set([
            ...tasks.map((task) => task.project_id),
            projectId || null,
        ].filter((id): id is string => Boolean(id)))];
        const missingProjectIds = relevantProjectIds.filter((id) => !(id in projectMembers));
        if (missingProjectIds.length === 0) return;
        let cancelled = false;
        void Promise.all(missingProjectIds.map(async (id) => [id, await listProjectMembers(id)] as const))
            .then((entries) => {
                if (!cancelled) setProjectMembers((current) => ({ ...current, ...Object.fromEntries(entries) }));
            })
            .catch(() => {
                if (!cancelled) setError("Could not load project members.");
            });
        return () => { cancelled = true; };
    }, [tasks, projectId, projectMembers, canAssignTasks]);
    async function addTask(event: React.FormEvent) {
        event.preventDefault();
        if (!title.trim()) return;
        try {
            if (!projectId) return;
            await createTask({
                title,
                priority,
                project_id: projectId,
                assignee_id: assigneeId || undefined,
            });
            setTitle("");
            setProjectId("");
            setAssigneeId("");
            setShowForm(false);
            const page = await listTasks({
                search: search || undefined,
                project_id: filterProjectId || undefined,
                assignee_id: filterAssigneeId || undefined,
            });
            setTasks(page.items);
        } catch {
            setError("Could not create task.");
        }
    }
    async function move(task: Task, status: TaskStatus) {
        if (!canCreateTasks && !(canUpdateAssignedTasks && task.assignee?.id === user?.id)) return;
        if (task.status === status) return;
        const previous = tasks;
        setTasks((current) =>
            current.map((item) => (item.id === task.id ? { ...item, status } : item)),
        );
        try {
            const updated = await updateTask(task.id, { status });
            setTasks((current) =>
                current.map((item) => (item.id === updated.id ? updated : item)),
            );
        } catch {
            setTasks(previous);
            setError("Could not update task.");
        }
    }
    async function submitTaskIssue(event: React.FormEvent<HTMLFormElement>, task: Task) {
        event.preventDefault();
        if (!task.project_id || !issueTitle.trim()) return;
        setIssueSaving(true);
        setIssueError(null);
        try {
            await reportTaskIssue(task.id, {
                title: issueTitle.trim(), description: issueDescription || undefined,
                category: issueCategory, priority: issuePriority, severity: issueSeverity,
                due_date: issueDueDate || undefined,
            });
            setReportingTaskId(null);
            setIssueTitle("");
            setIssueDescription("");
            setIssueCategory("general");
            setIssuePriority("medium");
            setIssueSeverity("medium");
            setIssueDueDate("");
            setError(null);
        } catch (err) {
            setIssueError(err instanceof ApiError ? err.message : "Could not report an issue for this task.");
        } finally {
            setIssueSaving(false);
        }
    }
    function handleDrop(status: TaskStatus) {
        const task = tasks.find((item) => item.id === draggedTaskId);
        setDraggedTaskId(null);
        setDropTarget(null);
        if (task) void move(task, status);
    }
    function canMoveTask(task: Task) {
        return canCreateTasks || (canUpdateAssignedTasks && task.assignee?.id === user?.id);
    }
    function startEditingTask(task: Task) {
        setEditingTaskId(task.id);
        setEditTaskTitle(task.title);
        setEditTaskDescription(task.description || "");
        setEditTaskPriority(task.priority);
        setEditTaskDueDate(task.due_date || "");
        setEditTaskAssigneeId(task.assignee?.id || "");
    }
    async function saveTask(event: React.FormEvent<HTMLFormElement>, taskId: string) {
        event.preventDefault();
        try {
            const changes = {
                title: editTaskTitle.trim(),
                description: editTaskDescription || null,
                priority: editTaskPriority,
                due_date: editTaskDueDate || null,
                ...(canAssignTasks ? { assignee_id: editTaskAssigneeId || null } : {}),
            };
            const updated = await updateTask(taskId, changes);
            setTasks((current) => current.map((task) => task.id === updated.id ? updated : task));
            setEditingTaskId(null);
        } catch {
            setError("Could not update task.");
        }
    }
    async function removeTask(task: Task) {
        if (!window.confirm(`Delete task “${task.title}”?`)) return;
        try {
            await deleteTask(task.id);
            setTasks((current) => current.filter((item) => item.id !== task.id));
        } catch {
            setError("Could not delete task.");
        }
    }
    const projectNames = new Map(projects.map((project) => [project.id, project.name]));
    return (
        <AppShell active="tasks" breadcrumb="Tasks">
            <div className="px-gutter-lg py-space-lg">
                <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h1 className="font-headline-xl text-headline-xl font-bold text-on-surface">
                            Tasks
                        </h1>
                        <p className="mt-1 text-on-surface-variant">
                            Drag work across the board as it moves forward.
                        </p>
                        {!canCreateTasks && canUpdateAssignedTasks && (
                            <p className="mt-1 text-sm text-on-surface-variant">You can update the status of tasks assigned to you.</p>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search tasks"
                            className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm"
                        />
                        <select
                            aria-label="Filter tasks by project"
                            value={filterProjectId}
                            onChange={(event) => setFilterProjectId(event.target.value)}
                            className="min-w-44 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm"
                        >
                            <option value="">{projectFilterLabel}</option>
                            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                        </select>
                        {canFilterByUser && (
                            <select
                                aria-label="Filter tasks by assignee"
                                value={filterAssigneeId}
                                onChange={(event) => setFilterAssigneeId(event.target.value)}
                                className="min-w-44 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm"
                            >
                                <option value="">All users</option>
                                {taskAssignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.full_name || assignee.email}</option>)}
                            </select>
                        )}
                        {canCreateTasks && (
                            <button
                                onClick={() => setShowForm((value) => !value)}
                                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
                            >
                                <Plus size={16} />
                                New task
                            </button>
                        )}
                    </div>
                </div>
                {error && (
                    <p className="mb-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
                        {error}
                    </p>
                )}
                {canCreateTasks && showForm && (
                    <form
                        onSubmit={addTask}
                        className="mb-6 flex flex-wrap gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-sm"
                    >
                        <select
                            required
                            value={projectId}
                            onChange={(event) => {
                                setProjectId(event.target.value);
                                setAssigneeId("");
                            }}
                            className="min-w-48 rounded-lg border border-outline-variant px-3 py-2 text-sm"
                        >
                            <option value="">Select project...</option>
                            {projects.map((project) => (
                                <option key={project.id} value={project.id}>{project.name}</option>
                            ))}
                        </select>
                        <input
                            autoFocus
                            required
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="Task title"
                            className="min-w-64 flex-1 rounded-lg border border-outline-variant px-3 py-2 text-sm"
                        />
                        <select
                            value={priority}
                            onChange={(event) =>
                                setPriority(event.target.value as TaskPriority)
                            }
                            className="rounded-lg border border-outline-variant px-3 py-2 text-sm"
                        >
                            <option value="low">Low priority</option>
                            <option value="medium">Medium priority</option>
                            <option value="high">High priority</option>
                            <option value="critical">Critical priority</option>
                        </select>
                        <select
                            value={assigneeId}
                            onChange={(event) => setAssigneeId(event.target.value)}
                            disabled={!projectId}
                            className="min-w-48 rounded-lg border border-outline-variant px-3 py-2 text-sm disabled:opacity-50"
                        >
                            <option value="">Unassigned</option>
                            {canAssignTasks && (projectMembers[projectId] || []).map((member) => (
                                <option key={member.user_id} value={member.user_id}>{member.full_name || member.email}</option>
                            ))}
                        </select>
                        <button className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-on-secondary">
                            Create
                        </button>
                    </form>
                )}
                {reportingTaskId && tasks.find((task) => task.id === reportingTaskId) && (() => {
                    const task = tasks.find((item) => item.id === reportingTaskId)!;
                    return <Dialog title="Report issue" description={`Linked to task: ${task.title}`} onClose={() => setReportingTaskId(null)}>
                        <form onSubmit={(event) => void submitTaskIssue(event, task)} className="space-y-3">
                            <label className="block text-sm font-medium text-on-surface-variant">Project
                                <input readOnly value={task.project_id ? projectNames.get(task.project_id) || "Project" : ""} className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface" />
                            </label>
                            <label className="block text-sm font-medium text-on-surface-variant">Issue title
                                <input required maxLength={200} value={issueTitle} onChange={(event) => setIssueTitle(event.target.value)} placeholder="Issue title" className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface" />
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                <label className="text-sm font-medium text-on-surface-variant">Category
                                    <select value={issueCategory} onChange={(event) => setIssueCategory(event.target.value)} className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface">
                                        <option value="general">General</option><option value="bug">Bug</option><option value="task">Task</option><option value="access">Access</option><option value="data">Data</option><option value="other">Other</option>
                                    </select>
                                </label>
                                <label className="text-sm font-medium text-on-surface-variant">Priority
                                    <select value={issuePriority} onChange={(event) => setIssuePriority(event.target.value as IssuePriority)} className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface">
                                        <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                                    </select>
                                </label>
                                <label className="text-sm font-medium text-on-surface-variant">Severity
                                    <select value={issueSeverity} onChange={(event) => setIssueSeverity(event.target.value as IssuePriority)} className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface">
                                        <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                                    </select>
                                </label>
                                <label className="text-sm font-medium text-on-surface-variant">Due date
                                    <input type="date" value={issueDueDate} onChange={(event) => setIssueDueDate(event.target.value)} className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface" />
                                </label>
                            </div>
                            <label className="block text-sm font-medium text-on-surface-variant">Description
                                <textarea value={issueDescription} onChange={(event) => setIssueDescription(event.target.value)} placeholder="Describe the issue and its impact" rows={3} className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface" />
                            </label>
                            {issueError && <p role="alert" className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{issueError}</p>}
                            <div className="flex justify-end gap-2 pt-1">
                                <button type="button" onClick={() => setReportingTaskId(null)} className="rounded-lg border border-outline-variant px-3 py-2 text-sm">Cancel</button>
                                <button type="submit" disabled={issueSaving || !task.project_id} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50">{issueSaving ? "Reporting..." : "Raise issue"}</button>
                            </div>
                        </form>
                    </Dialog>;
                })()}
                <div className="grid gap-4 lg:grid-cols-3">
                    {columns.map((column) => (
                        <section
                            key={column.status}
                            onDragOver={(event) => {
                                event.preventDefault();
                                setDropTarget(column.status);
                            }}
                            onDragLeave={() => setDropTarget(null)}
                            onDrop={() => handleDrop(column.status)}
                            className={`min-h-96 rounded-xl p-3 transition-colors ${dropTarget === column.status ? "bg-secondary-container/60 ring-2 ring-secondary" : "bg-surface-container-low"}`}
                        >
                            <div className="mb-3 flex items-center justify-between">
                                <h2 className="font-title-md font-bold text-on-surface">
                                    {column.label}
                                </h2>
                                <span className="rounded-full bg-surface-container-high px-2 py-1 text-xs text-on-surface-variant">
                                    {tasks.filter((task) => task.status === column.status).length}
                                </span>
                            </div>
                            <div className="min-h-80 space-y-3">
                                {tasks
                                    .filter((task) => task.status === column.status)
                                    .map((task) => (
                                        <article
                                            key={task.id}
                                            draggable={canMoveTask(task)}
                                            onDragStart={() => canMoveTask(task) && setDraggedTaskId(task.id)}
                                            onDragEnd={() => {
                                                setDraggedTaskId(null);
                                                setDropTarget(null);
                                            }}
                                            className={`rounded-lg bg-surface-container-lowest p-4 shadow-sm ${canMoveTask(task) ? "cursor-grab active:cursor-grabbing" : ""} ${draggedTaskId === task.id ? "opacity-50" : ""}`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex min-w-0 items-start gap-2">
                                                    {canMoveTask(task) && <GripVertical
                                                        size={16}
                                                        className="mt-0.5 shrink-0 text-outline"
                                                        aria-hidden="true"
                                                    />}
                                                    <h3 className="font-semibold text-on-surface">
                                                        {task.title}
                                                    </h3>
                                                </div>
                                                <span
                                                    className={`text-xs font-semibold uppercase ${priorityClass[task.priority]}`}
                                                >
                                                    {task.priority}
                                                </span>
                                            </div>
                                            {task.description && (
                                                <p className="mt-2 text-sm text-on-surface-variant">
                                                    {task.description}
                                                </p>
                                            )}
                                            <div className="mt-4 flex items-center justify-between text-xs text-outline">
                                                <span>{task.project_id ? projectNames.get(task.project_id) : ""}</span>
                                                {task.assignee ? (
                                                    <span className="inline-flex items-center gap-1">
                                                        <UserRound size={14} />
                                                        {task.assignee.full_name || task.assignee.email}
                                                    </span>
                                                ) : (
                                                    <span>Unassigned</span>
                                                )}
                                                {task.due_date && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <CalendarDays size={14} />
                                                        {task.due_date}
                                                    </span>
                                                )}
                                            </div>
                                            {canMoveTask(task) && <div className="mt-3 flex gap-2">
                                                {column.status !== "backlog" && (
                                                    <button
                                                        onClick={() => void move(task, "backlog")}
                                                        className="text-xs text-on-surface-variant"
                                                    >
                                                        To Do
                                                    </button>
                                                )}
                                                {column.status !== "in_progress" && (
                                                    <button
                                                        onClick={() => void move(task, "in_progress")}
                                                        className="text-xs text-secondary"
                                                    >
                                                        In progress
                                                    </button>
                                                )}
                                                {column.status !== "completed" && (
                                                    <button
                                                        onClick={() => void move(task, "completed")}
                                                        className="text-xs font-semibold text-primary"
                                                    >
                                                        Complete
                                                    </button>
                                                )}
                                            </div>}
                                            {(canCreateTasks || (canRaiseIssues && task.project_id)) && <div className="mt-3 flex items-center justify-between border-t border-outline-variant pt-3">
                                                {canRaiseIssues && task.project_id ? <button type="button" onClick={() => { setReportingTaskId(task.id); setIssueTitle(task.title); setIssueDescription(""); setIssueCategory("general"); setIssuePriority("medium"); setIssueSeverity("medium"); setIssueDueDate(""); setIssueError(null); }} className="text-xs font-semibold text-secondary hover:underline">Report issue</button> : <span />}
                                                {canCreateTasks && <div className="flex gap-2">
                                                    <button type="button" onClick={() => startEditingTask(task)} className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface hover:border-secondary hover:text-secondary">Edit</button>
                                                    <button type="button" onClick={() => void removeTask(task)} className="rounded-lg border border-error/40 px-3 py-1.5 text-xs font-semibold text-error hover:border-error">Delete</button>
                                                </div>}
                                            </div>}
                                            {editingTaskId === task.id && <form onSubmit={(event) => void saveTask(event, task.id)} className="mt-3 space-y-2 border-t border-outline-variant pt-3">
                                                <input required maxLength={200} value={editTaskTitle} onChange={(event) => setEditTaskTitle(event.target.value)} aria-label="Task title" className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm" />
                                                <textarea value={editTaskDescription} onChange={(event) => setEditTaskDescription(event.target.value)} aria-label="Task description" placeholder="Description" rows={2} className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm" />
                                                <div className="grid grid-cols-2 gap-2">
                                                    <select value={editTaskPriority} onChange={(event) => setEditTaskPriority(event.target.value as TaskPriority)} aria-label="Task priority" className="rounded-lg border border-outline-variant px-2 py-2 text-sm">
                                                        <option value="low">Low priority</option><option value="medium">Medium priority</option><option value="high">High priority</option><option value="critical">Critical priority</option>
                                                    </select>
                                                    <input type="date" value={editTaskDueDate} onChange={(event) => setEditTaskDueDate(event.target.value)} aria-label="Task due date" className="rounded-lg border border-outline-variant px-2 py-2 text-sm" />
                                                </div>
                                                {canAssignTasks && task.project_id && <label className="block space-y-1 text-xs font-medium text-on-surface-variant">
                                                    <span>Assign to</span>
                                                    <select value={editTaskAssigneeId} onChange={(event) => setEditTaskAssigneeId(event.target.value)} aria-label={`Assign ${task.title}`} className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm">
                                                        <option value="">Unassigned</option>
                                                        {(projectMembers[task.project_id] || []).map((member) => <option key={member.user_id} value={member.user_id}>{member.full_name || member.email}</option>)}
                                                    </select>
                                                </label>}
                                                <div className="flex justify-end gap-2">
                                                    <button type="button" onClick={() => setEditingTaskId(null)} className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs">Cancel</button>
                                                    <button type="submit" className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-on-secondary">Save</button>
                                                </div>
                                            </form>}
                                        </article>
                                    ))}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </AppShell>
    );
}
export default function TasksPage() {
    return (
        <RequireAuth>
            <TasksContent />
        </RequireAuth>
    );
}
