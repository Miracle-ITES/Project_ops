export type ProjectPriority = "low" | "medium" | "high" | "critical";
export type ProjectMaturity =
  | "planning"
  | "active"
  | "at_risk"
  | "blocked"
  | "completed";
export type MilestoneStatus = "pending" | "in_progress" | "completed";

export interface OwnerOut {
  id: string;
  email: string;
  full_name: string | null;
}

export interface ContributorOut {
  user_id: string;
  email: string;
  full_name: string | null;
}

export interface ProjectTeamOut {
  team_id: string;
  name: string;
  description: string | null;
}

export interface MilestoneOut {
  id: string;
  name: string;
  due_date: string | null;
  status: MilestoneStatus;
  created_at: string;
}

export interface ProjectListItemOut {
  id: string;
  name: string;
  priority: ProjectPriority;
  maturity: ProjectMaturity;
  owner: OwnerOut;
  created_at: string;
}

export interface ProjectDetailOut {
  id: string;
  name: string;
  description: string | null;
  priority: ProjectPriority;
  maturity: ProjectMaturity;
  owner: OwnerOut;
  contributors: ContributorOut[];
  teams: ProjectTeamOut[];
  milestones: MilestoneOut[];
  created_at: string;
  updated_at: string;
}
