import { authedFetch } from "./api-client";
import type { ActivityOut } from "@/types/activity";

export function listActivity(): Promise<ActivityOut[]> {
  return authedFetch<ActivityOut[]>("/activity");
}
