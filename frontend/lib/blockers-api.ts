import { authedFetch } from "./api-client";
import type { BlockerOut, BlockerStatus } from "@/types/blockers";

export function listBlockers(): Promise<BlockerOut[]> {
  return authedFetch<BlockerOut[]>("/blockers");
}

export function createBlocker(payload: {
  project_id: string;
  title: string;
  description?: string;
}): Promise<BlockerOut> {
  return authedFetch<BlockerOut>("/blockers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
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
