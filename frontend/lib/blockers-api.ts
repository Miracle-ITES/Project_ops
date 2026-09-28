import { authedFetch } from "./api-client";
import type { BlockerOut, BlockerStatus } from "@/types/blockers";

export function listBlockers(): Promise<BlockerOut[]> {
  return authedFetch<BlockerOut[]>("/blockers");
}

export function createBlocker(payload: {
  project_id: string;
  title: string;
  description?: string;
  assignee_id?: string;
}): Promise<BlockerOut> {
  return authedFetch<BlockerOut>("/blockers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function assignBlocker(blockerId: string, assigneeId: string | null): Promise<BlockerOut> {
  return authedFetch<BlockerOut>(`/blockers/${blockerId}/assignee`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assignee_id: assigneeId }),
  });
}

export function updateBlockerStatus(
  blockerId: string,
  status: BlockerStatus,
): Promise<BlockerOut> {
  return authedFetch<BlockerOut>(`/blockers/${blockerId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}
