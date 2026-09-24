export interface RoleOut {
  id: string;
  name: string;
  permissions: string[];
}

export interface UserOut {
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

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}
