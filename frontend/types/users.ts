import type { RoleOut } from "./auth";

export interface UserListItemOut {
  id: string;
  created_at: string;
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

export type InvitationRequestStatus = "pending" | "approved" | "rejected";

export interface InvitationRequestOut {
  id: string;
  email: string;
  full_name: string | null;
  role_name: string;
  status: InvitationRequestStatus;
  requested_by_id: string;
  requested_by_name: string | null;
  created_at: string;
  reviewed_at: string | null;
  review_note: string | null;
}
