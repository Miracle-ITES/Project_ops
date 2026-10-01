import { authedFetch } from "./api-client";
import type { BlockerOut, BlockerPage, BlockerStatus } from "@/types/blockers";

export function listBlockers(page = 1, pageSize = 50): Promise<BlockerPage> {
	return authedFetch<BlockerPage | BlockerOut[]>(`/blockers?page=${page}&page_size=${pageSize}`).then((response) => {
		// Keep the page usable while an already-running backend is still serving
		// the legacy array response during development/reload.
		if (Array.isArray(response)) {
			return {
				items: response,
				page: 1,
				page_size: response.length,
				total: response.length,
				pages: response.length ? 1 : 0,
			};
		}
		return response;
	});
}

export function createBlocker(payload: {
  project_id: string;
  task_id?: string;
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
