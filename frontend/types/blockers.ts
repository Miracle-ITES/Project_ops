export type BlockerStatus = "open" | "resolved";

export interface BlockerOut {
  id: string;
  project_id: string;
  project_name: string;
  title: string;
  description: string | null;
  status: BlockerStatus;
  raised_by_id: string;
  raised_by_email: string;
  created_at: string;
  resolved_at: string | null;
}
