"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { Dialog } from "@/components/dialog";
import Link from "next/link";
import { RequireAuth } from "@/components/require-auth";
import { ApiError } from "@/lib/api-client";
import { addIssueComment, createIssue, escalateIssue, listIssueComments, listIssueHistory, listIssues, updateIssue } from "@/lib/issues-api";
import { listProjects } from "@/lib/projects-api";
import { listTasks } from "@/lib/work-api";
import { useAuth } from "@/lib/auth-context";
import type { Issue, IssueComment, IssueHistoryEvent, IssuePriority, IssueStatus } from "@/types/issues";
import type { ProjectListItemOut } from "@/types/projects";
import type { Task } from "@/types/work";

const statusLabels: Record<IssueStatus, string> = { open: "Open", in_progress: "In progress", resolved: "Resolved", closed: "Closed", escalated: "Escalated" };
const editableStatuses: IssueStatus[] = ["open", "in_progress", "resolved", "closed"];

function IssuesContent() {
  const { hasPermission } = useAuth();
  const canRaise = hasPermission("issues:raise");
  const canManage = hasPermission("issues:manage");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [issueTotal, setIssueTotal] = useState(0);
  const [projects, setProjects] = useState<ProjectListItemOut[]>([]);
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState<IssuePriority>("medium");
  const [severity, setSeverity] = useState<IssuePriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [collaborationIssueId, setCollaborationIssueId] = useState<string | null>(null);
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [history, setHistory] = useState<IssueHistoryEvent[]>([]);
  const [historyIssue, setHistoryIssue] = useState<Issue | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [collaborationError, setCollaborationError] = useState<string | null>(null);
  const [collaborationLoading, setCollaborationLoading] = useState(false);
  const [commentSaving, setCommentSaving] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [escalationIssue, setEscalationIssue] = useState<Issue | null>(null);
  const [escalating, setEscalating] = useState(false);

  const load = useCallback(async (requestedPage = page) => {
    try {
      const [issuePage, projectList] = await Promise.all([listIssues(requestedPage), listProjects()]);
      setIssues(issuePage.items);
      setPage(issuePage.page);
      setPageCount(issuePage.pages);
      setIssueTotal(issuePage.total);
      setProjects(projectList);
      if (!projectId && projectList[0]) {
        setTasksLoading(true);
        setProjectId(projectList[0].id);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load issues.");
    }
  }, [page, projectId]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void load(); });
    return () => { cancelled = true; };
  }, [load]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void listTasks({ project_id: projectId, page_size: 100 })
      .then((response) => { if (!cancelled) setProjectTasks(response.items); })
      .catch((err) => {
        if (!cancelled) {
          setProjectTasks([]);
          setError(err instanceof ApiError ? err.message : "Could not load tasks for this project.");
        }
      })
      .finally(() => { if (!cancelled) setTasksLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId || !title.trim()) return;
    setSaving(true); setError(null); setNotice(null);
    try {
      await createIssue({ project_id: projectId, task_id: taskId || undefined, title: title.trim(), description: description || undefined, category, priority, severity, due_date: dueDate || undefined });
      setTitle(""); setDescription(""); setDueDate(""); setTaskId(""); setCategory("general"); setPriority("medium"); setSeverity("medium");
      setNotice("Issue reported.");
      await load(1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not report the issue.");
    } finally { setSaving(false); }
  }

  async function changeIssue(issue: Issue, patch: { status?: IssueStatus; priority?: IssuePriority }) {
    setError(null);
    try {
      const updated = await updateIssue(issue.id, patch);
      setIssues((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (err) { setError(err instanceof ApiError ? err.message : "Could not update the issue."); }
  }

  async function confirmEscalation() {
    if (!escalationIssue) return;
    setEscalating(true);
    setError(null);
    try {
      const updated = await escalateIssue(escalationIssue.id);
      setIssues((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice("Issue escalated to a ticket.");
      setEscalationIssue(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not escalate the issue.");
    } finally {
      setEscalating(false);
    }
  }

  async function toggleCollaboration(issueId: string) {
    if (collaborationIssueId === issueId) {
      setCollaborationIssueId(null);
      return;
    }
    setCollaborationIssueId(issueId);
    setCollaborationError(null);
    setCollaborationLoading(true);
    try {
      setComments(await listIssueComments(issueId));
    } catch (err) {
      setComments([]);
      setCollaborationError(err instanceof ApiError
        ? err.message
        : "Could not load the issue discussion.");
    } finally {
      setCollaborationLoading(false);
    }
  }

  async function openHistory(issue: Issue) {
    setHistoryIssue(issue);
    setHistory([]);
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      setHistory(await listIssueHistory(issue.id));
    } catch (err) {
      setHistoryError(err instanceof ApiError ? err.message : "Could not load issue history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const issueId = collaborationIssueId;
    if (!issueId || !commentDraft.trim()) return;
    setCommentSaving(true);
    setCollaborationError(null);
    try {
      await addIssueComment(issueId, commentDraft);
      setCommentDraft("");
      setComments(await listIssueComments(issueId));
    } catch (err) {
      setCollaborationError(err instanceof ApiError ? err.message : "Could not add the comment.");
    } finally {
      setCommentSaving(false);
    }
  }

  return <AppShell active="issues" breadcrumb="Issues">
    <div className="max-w-7xl px-gutter-lg py-space-lg">
      <div className="mb-6">
        <h1 className="font-headline-xl text-headline-xl font-bold text-on-surface">Issues</h1>
        <p className="mt-1 text-on-surface-variant">Report project issues and follow their status.</p>
      </div>
      {error && <p role="alert" className="mb-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-lg bg-secondary-container px-3 py-2 text-sm text-on-secondary-container">{notice}</p>}
      <div className="grid items-start gap-6 lg:grid-cols-2">
      {canRaise && <form onSubmit={submit} className="rounded-xl bg-surface-container-lowest p-5 shadow-sm">
        <h2 className="font-title-md font-semibold text-on-surface">Report an issue</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <select required value={projectId} onChange={(event) => { setProjectId(event.target.value); setTaskId(""); setProjectTasks([]); setTasksLoading(Boolean(event.target.value)); }} className="rounded-lg border border-outline-variant px-3 py-2 text-sm">
            <option value="">Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <select aria-label="Related task (optional)" value={taskId} onChange={(event) => setTaskId(event.target.value)} disabled={!projectId || tasksLoading} className="rounded-lg border border-outline-variant px-3 py-2 text-sm disabled:opacity-60">
            <option value="">{tasksLoading ? "Loading project tasks..." : "No related task (optional)"}</option>
            {projectTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
          </select>
          <input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Issue title" className="rounded-lg border border-outline-variant px-3 py-2 text-sm" />
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border border-outline-variant px-3 py-2 text-sm">
            <option value="general">General</option><option value="bug">Bug</option><option value="task">Task</option><option value="access">Access</option><option value="data">Data</option><option value="other">Other</option>
          </select>
          <select value={priority} onChange={(event) => setPriority(event.target.value as IssuePriority)} className="rounded-lg border border-outline-variant px-3 py-2 text-sm">
            <option value="low">Low priority</option><option value="medium">Medium priority</option><option value="high">High priority</option><option value="critical">Critical priority</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-on-surface-variant">Severity
            <select value={severity} onChange={(event) => setSeverity(event.target.value as IssuePriority)} className="rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface">
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-on-surface-variant">Due date <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface" /></label>
        </div>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the issue and its impact" rows={3} className="mt-3 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm" />
        <button type="submit" disabled={saving || !projectId} className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-50">{saving ? "Reporting..." : "Report issue"}</button>
      </form>}
      <section className="space-y-3">
        <h2 className="font-title-md font-semibold text-on-surface">Reported issues</h2>
        {issues.length === 0 ? <p className="rounded-xl bg-surface-container-lowest p-6 text-sm text-on-surface-variant">No issues to show.</p> : issues.map((issue) => <article key={issue.id} className="rounded-xl bg-surface-container-lowest p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h2 className="font-title-md font-semibold text-on-surface">{issue.title}</h2><span className="rounded-full bg-secondary-container px-2 py-0.5 text-xs font-semibold text-on-secondary-container">{statusLabels[issue.status]}</span><span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs">{issue.priority} priority</span></div>
              <p className="mt-1 text-sm text-secondary">{issue.project_name}{issue.task_title ? ` · ${issue.task_title}` : ""}</p>
              {issue.description && <p className="mt-2 whitespace-pre-wrap text-sm text-on-surface-variant">{issue.description}</p>}
              <p className="mt-3 text-xs text-outline">{issue.category} · Severity {issue.severity} · Reported by {issue.reporter_name} · {new Date(issue.created_at).toLocaleString()}{issue.due_date ? ` · Due ${issue.due_date}` : ""}</p>
            </div>
            {canManage && <div className="flex flex-wrap gap-2">
              <select aria-label={`Status for ${issue.title}`} value={issue.status} disabled={issue.status === "escalated"} onChange={(event) => void changeIssue(issue, { status: event.target.value as IssueStatus })} className="rounded-lg border border-outline-variant px-2 py-1.5 text-sm disabled:opacity-60">
                {issue.status === "escalated" && <option value="escalated">Escalated</option>}
                {editableStatuses.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}
              </select>
              <select aria-label={`Priority for ${issue.title}`} value={issue.priority} onChange={(event) => void changeIssue(issue, { priority: event.target.value as IssuePriority })} className="rounded-lg border border-outline-variant px-2 py-1.5 text-sm">
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
              </select>
            </div>}
          </div>
          {issue.escalated_to_blocker_id ? <p className="mt-3 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">
            Escalated to ticket <span className="font-mono text-xs">{issue.escalated_to_blocker_id}</span> · <Link href="/blockers" className="font-semibold underline">View tickets</Link>
          </p> : canManage && issue.status !== "resolved" && issue.status !== "closed" && <div className="mt-3">
            <button type="button" onClick={() => setEscalationIssue(issue)} className="rounded-lg border border-outline-variant px-3 py-1.5 text-sm font-medium text-on-surface transition-colors hover:border-error hover:text-error">Escalate to ticket</button>
          </div>}
          <div className="mt-4 border-t border-outline-variant pt-3">
            <div className="flex gap-4">
              <button type="button" aria-expanded={collaborationIssueId === issue.id} onClick={() => void toggleCollaboration(issue.id)} className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${collaborationIssueId === issue.id ? "border-secondary bg-secondary-container text-on-secondary-container" : "border-outline-variant bg-surface-container-lowest text-on-surface hover:border-secondary hover:text-secondary"}`}>
                {collaborationIssueId === issue.id ? "Hide comments" : "Comments"}
              </button>
              <button type="button" onClick={() => void openHistory(issue)} className="inline-flex items-center rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-sm font-medium text-on-surface transition-colors hover:border-secondary hover:text-secondary">History</button>
            </div>
            {collaborationIssueId === issue.id && <div className="mt-3 space-y-4">
              {collaborationLoading ? <p className="text-sm text-on-surface-variant">Loading discussion...</p> : collaborationError
                ? <p role="alert" className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{collaborationError}</p>
                : <>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-outline">Discussion</h3>
                    {comments.length === 0 ? <p className="mt-2 text-sm text-on-surface-variant">No comments yet.</p> : <ul className="mt-2 space-y-2">
                      {comments.map((comment) => <li key={comment.id} className="rounded-lg bg-surface-container-low p-3">
                        <div className="flex justify-between gap-2 text-xs text-outline"><span className="font-semibold text-on-surface-variant">{comment.author_name}</span><time>{new Date(comment.created_at).toLocaleString()}</time></div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-on-surface">{comment.body}</p>
                      </li>)}
                    </ul>}
                    <form onSubmit={(event) => void submitComment(event)} className="mt-3 space-y-2">
                      <textarea required maxLength={5000} value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Add a comment" rows={2} className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm" />
                      <button type="submit" disabled={commentSaving || !commentDraft.trim()} className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-on-secondary disabled:opacity-50">{commentSaving ? "Posting..." : "Post comment"}</button>
                    </form>
                  </div>
                </>}
            </div>}
          </div>
        </article>)}
      {pageCount > 1 && <div className="mt-5 flex items-center justify-between gap-3 text-sm text-on-surface-variant">
        <span>{issueTotal} issues · Page {page} of {pageCount}</span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-outline-variant px-3 py-1.5 disabled:opacity-50">Previous</button>
          <button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="rounded-lg border border-outline-variant px-3 py-1.5 disabled:opacity-50">Next</button>
        </div>
      </div>}
      </section>
      </div>
    </div>
    {historyIssue && <Dialog title="Issue history" description={`${historyIssue.title} · ${historyIssue.project_name}`} onClose={() => setHistoryIssue(null)}>
      {historyLoading ? <p className="text-sm text-on-surface-variant">Loading history...</p>
        : historyError ? <p role="alert" className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{historyError}</p>
          : history.length === 0 ? <p className="text-sm text-on-surface-variant">No history recorded yet.</p>
            : <ol className="max-h-[65vh] space-y-4 overflow-y-auto border-l-2 border-outline-variant pl-4">
              {history.map((event) => <li key={event.id} className="text-sm">
                <p className="font-medium text-on-surface">{event.detail}</p>
                <p className="mt-1 text-xs text-outline">{event.actor_name} · {new Date(event.created_at).toLocaleString()}</p>
              </li>)}
            </ol>}
    </Dialog>}
    {escalationIssue && <Dialog title="Escalate issue to ticket?" description="This will create a linked blocker for the project. The issue will move to Escalated and cannot be escalated again." onClose={() => !escalating && setEscalationIssue(null)}>
      <div className="space-y-4">
        <div className="rounded-lg bg-surface-container-low p-3">
          <p className="font-semibold text-on-surface">{escalationIssue.title}</p>
          <p className="mt-1 text-sm text-on-surface-variant">{escalationIssue.project_name}</p>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" disabled={escalating} onClick={() => setEscalationIssue(null)} className="rounded-lg border border-outline-variant px-3 py-2 text-sm disabled:opacity-50">Cancel</button>
          <button type="button" disabled={escalating} onClick={() => void confirmEscalation()} className="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-on-error disabled:opacity-50">{escalating ? "Escalating..." : "Create ticket"}</button>
        </div>
      </div>
    </Dialog>}
  </AppShell>;
}

export default function IssuesPage() {
  return <RequireAuth permission="issues:view"><IssuesContent /></RequireAuth>;
}
