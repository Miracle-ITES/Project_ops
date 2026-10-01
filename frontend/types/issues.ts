export type IssueStatus = "open" | "in_progress" | "resolved" | "closed" | "escalated";
export type IssuePriority = "low" | "medium" | "high" | "critical";
export type IssueSeverity = IssuePriority;
export type IssueSource = "manual" | "task";

export interface Issue {
  id: string;
  project_id: string;
  project_name: string;
  task_id: string | null;
  task_title: string | null;
  title: string;
  description: string | null;
  type: string;
  category: string;
  priority: IssuePriority;
  severity: IssueSeverity;
  status: IssueStatus;
  reporter_id: string;
  reporter_name: string;
  assignee_id: string | null;
  assignee_name: string | null;
  source: IssueSource;
  due_date: string | null;
  resolution: string | null;
  resolved_by_id: string | null;
  resolved_at: string | null;
  escalated_to_blocker_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface IssuePage {
  items: Issue[];
  page: number;
  page_size: number;
  total: number;
  pages: number;
}

export interface IssueComment {
  id: string;
  issue_id: string;
  author_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
}

export interface IssueHistoryEvent {
  id: string;
  issue_id: string;
  actor_id: string | null;
  actor_name: string;
  event_type: string;
  detail: string;
  created_at: string;
}
