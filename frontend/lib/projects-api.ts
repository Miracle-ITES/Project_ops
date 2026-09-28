import { authedFetch } from "./api-client";
import type {
  MilestoneStatus,
  ContributorOut,
  ProjectDetailOut,
  ProjectListItemOut,
  ProjectMaturity,
  ProjectPriority,
} from "../types/projects";

export function listProjects(): Promise<ProjectListItemOut[]> {
  return authedFetch<ProjectListItemOut[]>("/projects");
}

export function getProject(projectId: string): Promise<ProjectDetailOut> {
  return authedFetch<ProjectDetailOut>(`/projects/${projectId}`);
}

export function listProjectMembers(
  projectId: string,
): Promise<ContributorOut[]> {
  return authedFetch<ContributorOut[]>(`/projects/${projectId}/members`);
}

export function createProject(payload: {
  name: string;
  description?: string;
  priority: ProjectPriority;
  maturity: ProjectMaturity;
  owner_id?: string;
}): Promise<ProjectDetailOut> {
  return authedFetch<ProjectDetailOut>("/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function updateProject(
  projectId: string,
  payload: Partial<{
    name: string;
    description: string;
    priority: ProjectPriority;
    maturity: ProjectMaturity;
  }>,
): Promise<ProjectDetailOut> {
  return authedFetch<ProjectDetailOut>(`/projects/${projectId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function addContributor(
  projectId: string,
  userId: string,
): Promise<ProjectDetailOut> {
  return authedFetch<ProjectDetailOut>(`/projects/${projectId}/contributors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
}

export function addTeam(
  projectId: string,
  teamId: string,
): Promise<ProjectDetailOut> {
  return authedFetch<ProjectDetailOut>(`/projects/${projectId}/teams`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ team_id: teamId }),
  });
}

export function removeTeam(projectId: string, teamId: string): Promise<void> {
  return authedFetch<void>(`/projects/${projectId}/teams/${teamId}`, {
    method: "DELETE",
  });
}

export function addMilestone(
  projectId: string,
  payload: { name: string; due_date?: string; status?: MilestoneStatus },
): Promise<ProjectDetailOut> {
  return authedFetch<ProjectDetailOut>(`/projects/${projectId}/milestones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
