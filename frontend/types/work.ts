export type TaskStatus = "backlog" | "in_progress" | "completed";
export type TaskPriority = "low" | "medium" | "high" | "critical";
export type LearningStatus = "planned" | "in_progress" | "completed";

export interface UserBrief {
  id: string;
  email: string;
  full_name: string | null;
}
export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee: UserBrief | null;
  reviewer: UserBrief | null;
  created_by: UserBrief;
  created_at: string;
  updated_at: string;
}
export interface PageMeta {
  page: number;
  page_size: number;
  total: number;
  pages: number;
}
export interface TaskPage {
  items: Task[];
  meta: PageMeta;
}
export interface DailyUpdate {
  id: string;
  update_date: string;
  summary: string;
  accomplishments: string | null;
  plans: string | null;
  blockers: string | null;
  user: UserBrief;
}
export interface DailyUpdatePage {
  items: DailyUpdate[];
  meta: PageMeta;
}
export interface LearningItem {
  id: string;
  topic: string;
  notes: string | null;
  status: LearningStatus;
  session_date: string | null;
  completed_at: string | null;
  owner: UserBrief;
}
export interface LearningPage {
  items: LearningItem[];
  meta: PageMeta;
}
export interface Dashboard {
  active_projects: number;
  tasks_due_today: number;
  open_blockers: number;
  completed_tasks: number;
  task_total: number;
  learning_completed: number;
  daily_updates_today: number;
}
