import { authedFetch } from "./api-client";
import type { Issue, IssueComment, IssueHistoryEvent, IssuePage, IssuePriority, IssueSeverity, IssueStatus } from "@/types/issues";

export interface IssueCreate {
  project_id: string;
  task_id?: string;
  title: string;
  description?: string;
  type?: string;
  category?: string;
  priority?: IssuePriority;
  severity?: IssueSeverity;
  assignee_id?: string;
  due_date?: string;
}

export function listIssues(page = 1): Promise<IssuePage> {
  return authedFetch(`/issues?page=${page}&page_size=50`);
}

export function createIssue(payload: IssueCreate): Promise<Issue> {
  return authedFetch("/issues", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
}

export function reportTaskIssue(taskId: string, payload: Omit<IssueCreate, "project_id">): Promise<Issue> {
  return authedFetch(`/tasks/${taskId}/report-issue`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
}

export function updateIssue(issueId: string, payload: Partial<{
  status: IssueStatus; priority: IssuePriority; severity: IssueSeverity;
  assignee_id: string | null; due_date: string | null; resolution: string | null;
}>): Promise<Issue> {
  return authedFetch(`/issues/${issueId}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
}

export function listIssueComments(issueId: string): Promise<IssueComment[]> {
  return authedFetch(`/issues/${issueId}/comments`);
}

export function listIssueHistory(issueId: string): Promise<IssueHistoryEvent[]> {
  return authedFetch(`/issues/${issueId}/history`);
}

export function addIssueComment(issueId: string, body: string): Promise<IssueComment> {
  return authedFetch(`/issues/${issueId}/comments`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }),
  });
}

export function escalateIssue(issueId: string): Promise<Issue> {
  return authedFetch(`/issues/${issueId}/escalate`, { method: "POST" });
}
