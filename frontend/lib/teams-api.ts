import { authedFetch } from "./api-client";
import type { MyTeamMemberOut, TeamOut, TeamRosterOut } from "@/types/teams";

export function listTeams(): Promise<TeamOut[]> {
  return authedFetch<TeamOut[]>("/teams");
}

export function listMyTeams(): Promise<TeamOut[]> {
  return authedFetch<TeamOut[]>("/teams/mine");
}

export function listAssignableTeams(): Promise<TeamOut[]> {
  return authedFetch<TeamOut[]>("/teams/assignable");
}

export function createTeam(payload: {
  name: string;
  description?: string;
}): Promise<TeamOut> {
  return authedFetch<TeamOut>("/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function getRoster(teamId: string): Promise<TeamRosterOut> {
  return authedFetch<TeamRosterOut>(`/teams/${teamId}/roster`);
}

export function listMyTeamMembers(): Promise<MyTeamMemberOut[]> {
  return authedFetch<MyTeamMemberOut[]>("/teams/mine/members");
}

export function addMember(teamId: string, userId: string): Promise<TeamOut> {
  return authedFetch<TeamOut>(`/teams/${teamId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
}

export function removeMember(teamId: string, userId: string): Promise<void> {
  return authedFetch<void>(`/teams/${teamId}/members/${userId}`, {
    method: "DELETE",
  });
}
