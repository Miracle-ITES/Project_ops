"use client";

import { useEffect, useState } from "react";
import { CalendarDays, GripVertical, Plus, UserRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth-context";
import { listProjectMembers, listProjects } from "@/lib/projects-api";
import { createTask, listTasks, updateTask } from "@/lib/work-api";
import type { ContributorOut, ProjectListItemOut } from "@/types/projects";
import type { Task, TaskPriority, TaskStatus } from "@/types/work";

const columns: { status: TaskStatus; label: string }[] = [
    { status: "backlog", label: "Backlog" },
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
    const canUpdateAssignedTasks = hasPermission("status:update");
    const [tasks, setTasks] = useState<Task[]>([]);
    const [projects, setProjects] = useState<ProjectListItemOut[]>([]);
    const [projectMembers, setProjectMembers] = useState<ContributorOut[]>([]);
    const [search, setSearch] = useState("");
    const [title, setTitle] = useState("");
    const [priority, setPriority] = useState<TaskPriority>("medium");
    const [projectId, setProjectId] = useState("");
    const [assigneeId, setAssigneeId] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);
    useEffect(() => {
        void listTasks({ search: search || undefined })
            .then((page) => setTasks(page.items))
            .catch(() => setError("Could not load tasks."));
    }, [search]);
    useEffect(() => {
        void listProjects()
            .then(setProjects)
            .catch(() => setError("Could not load projects."));
    }, []);
    useEffect(() => {
        if (!projectId || !canCreateTasks) return;
        void listProjectMembers(projectId)
            .then(setProjectMembers)
            .catch(() => setError("Could not load project members."));
    }, [projectId, canCreateTasks]);
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
            const page = await listTasks({ search: search || undefined });
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
    function handleDrop(status: TaskStatus) {
        const task = tasks.find((item) => item.id === draggedTaskId);
        setDraggedTaskId(null);
        setDropTarget(null);
        if (task) void move(task, status);
    }
    function canMoveTask(task: Task) {
        return canCreateTasks || (canUpdateAssignedTasks && task.assignee?.id === user?.id);
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
                    </div>
                    <div className="flex gap-2">
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search tasks"
                            className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm"
                        />
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
                                setProjectMembers([]);
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
                            {projectMembers.map((member) => (
                                <option key={member.user_id} value={member.user_id}>{member.full_name || member.email}</option>
                            ))}
                        </select>
                        <button className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-on-secondary">
                            Create
                        </button>
                    </form>
                )}
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
                                                        Backlog
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
