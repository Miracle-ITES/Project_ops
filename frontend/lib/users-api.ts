import { authedFetch } from "./api-client";
import type { UserListItemOut } from "@/types/users";

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
  password: string;
  full_name?: string;
  role_name: string;
}): Promise<UserListItemOut> {
  return authedFetch<UserListItemOut>("/users", {
    method: "POST",
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
