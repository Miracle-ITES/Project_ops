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
  role: RoleOut;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}
