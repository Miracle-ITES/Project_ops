import { authedFetch } from "./api-client";
import type { InvitationRequestOut, UserListItemOut } from "@/types/users";

export function listUsers(): Promise<UserListItemOut[]> {
  return authedFetch<UserListItemOut[]>("/users");
}

export function listAssignableUsers(): Promise<UserListItemOut[]> {
  return authedFetch<UserListItemOut[]>("/users/assignable");
}

export function getUser(userId: string): Promise<UserListItemOut> {
  return authedFetch<UserListItemOut>(`/users/${userId}`);
}

export function createUser(payload: {
  email: string;
  full_name?: string;
  role_name: string;
}): Promise<UserListItemOut> {
  return authedFetch<UserListItemOut>("/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function requestUser(payload: {
  email: string;
  full_name?: string;
  role_name: string;
}): Promise<InvitationRequestOut> {
  return authedFetch<InvitationRequestOut>("/users/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function listInvitationRequests(): Promise<InvitationRequestOut[]> {
  return authedFetch<InvitationRequestOut[]>("/users/requests");
}

export function listMyInvitationRequests(): Promise<InvitationRequestOut[]> {
  return authedFetch<InvitationRequestOut[]>("/users/requests/mine");
}

export function approveInvitationRequest(
  id: string,
  note?: string,
): Promise<UserListItemOut> {
  return authedFetch<UserListItemOut>(`/users/requests/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
}

export function rejectInvitationRequest(
  id: string,
  note?: string,
): Promise<InvitationRequestOut> {
  return authedFetch<InvitationRequestOut>(`/users/requests/${id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note }),
  });
}

export interface ProfileUpdate {
  full_name: string;
  company_name?: string;
  job_title?: string;
  department?: string;
  phone_number?: string;
  location?: string;
}

export function updateMyProfile(
  payload: ProfileUpdate,
): Promise<UserListItemOut> {
  return authedFetch<UserListItemOut>("/users/me/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function updateUserProfile(
  userId: string,
  payload: ProfileUpdate,
): Promise<UserListItemOut> {
  return authedFetch<UserListItemOut>(`/users/${userId}/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function changeUserRole(
  userId: string,
  roleName: string,
): Promise<UserListItemOut> {
  return authedFetch<UserListItemOut>(`/users/${userId}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role_name: roleName }),
  });
}

export function setUserActive(
  userId: string,
  isActive: boolean,
): Promise<UserListItemOut> {
  return authedFetch<UserListItemOut>(`/users/${userId}/active`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_active: isActive }),
  });
}

export function changeUserPassword(userId: string, password: string): Promise<void> {
  return authedFetch<void>(`/users/${userId}/password`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
}
