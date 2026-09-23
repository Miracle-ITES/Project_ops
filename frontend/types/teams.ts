export interface TeamOut {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface RosterMemberOut {
  user_id: string;
  email: string;
  full_name: string | null;
  role_name: string;
  joined_at: string;
}

export interface TeamRosterOut {
  team: TeamOut;
  members: RosterMemberOut[];
}
