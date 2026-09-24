export interface ActivityOut {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  detail: string | null;
  ip_address: string | null;
  created_at: string;
}
