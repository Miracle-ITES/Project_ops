import { authedFetch } from "./api-client";
import type {
  Dashboard,
  DailyUpdate,
  DailyUpdatePage,
  LearningItem,
  LearningPage,
  Task,
  TaskPage,
  TaskPriority,
  TaskStatus,
  LearningStatus,
} from "@/types/work";

const query = (params: Record<string, string | undefined>) =>
  new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  ).toString();
export function listTasks(
  params: { search?: string; status?: TaskStatus } = {},
): Promise<TaskPage> {
  return authedFetch(`/tasks?${query(params)}`);
}
export function createTask(payload: {
  title: string;
  description?: string;
  priority: TaskPriority;
  due_date?: string;
  project_id: string;
  assignee_id?: string;
  reviewer_id?: string;
}): Promise<Task> {
  return authedFetch("/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
export function updateTask(
  id: string,
  payload: Partial<{
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string;
    assignee_id: string | null;
    reviewer_id: string | null;
  }>,
): Promise<Task> {
  return authedFetch(`/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
export function getDashboard(): Promise<Dashboard> {
  return authedFetch("/dashboard");
}
export function listDailyUpdates(search?: string): Promise<DailyUpdatePage> {
  return authedFetch(`/daily-updates?${query({ search })}`);
}
export function submitDailyUpdate(payload: {
  update_date: string;
  summary: string;
  accomplishments?: string;
  plans?: string;
  blockers?: string;
}): Promise<DailyUpdate> {
  return authedFetch("/daily-updates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
export function listLearning(): Promise<LearningPage> {
  return authedFetch("/learning");
}
export function createLearning(payload: {
  topic: string;
  notes?: string;
  session_date?: string;
}): Promise<LearningItem> {
  return authedFetch("/learning", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
export function updateLearning(
  id: string,
  status: LearningStatus,
): Promise<LearningItem> {
  return authedFetch(`/learning/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}
