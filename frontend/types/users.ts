import type { RoleOut } from "./auth";

export interface UserListItemOut {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  profile_completed: boolean;
  company_name: string | null;
  job_title: string | null;
  department: string | null;
  phone_number: string | null;
  location: string | null;
  role: RoleOut;
}
