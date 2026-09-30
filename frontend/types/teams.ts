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
  end_date: string | null;
  team_count: number;
}

export interface TeamMembershipHistoryOut {
  user_id: string;
  email: string;
  full_name: string | null;
  role_name: string;
  joined_at: string;
  end_date: string | null;
  left_at: string | null;
}

export interface TeamRosterOut {
  team: TeamOut;
  members: RosterMemberOut[];
}

export interface MyTeamMemberOut {
  user_id: string;
  email: string;
  full_name: string | null;
  role_name: string;
  is_active: boolean;
  team_names: string[];
}
