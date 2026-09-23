import type { RoleOut } from "./auth";

export interface UserListItemOut {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  role: RoleOut;
}
