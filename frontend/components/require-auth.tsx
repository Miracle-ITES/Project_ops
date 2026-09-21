"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface RequireAuthProps {
  children: ReactNode;
  /** Optional permission code — if the user lacks it, they're redirected away
   * rather than shown the page. This is a UX convenience only: the backend's
   * require_permission(...) on the actual API routes is the real boundary,
   * since anyone can bypass client-side checks via devtools. */
  permission?: string;
}

export function RequireAuth({ children, permission }: RequireAuthProps) {
  const { user, isLoading, hasPermission } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (permission && !hasPermission(permission)) {
      router.replace("/");
    }
  }, [isLoading, user, permission, hasPermission, router]);

  if (isLoading || !user) return null;
  if (permission && !hasPermission(permission)) return null;

  return <>{children}</>;
}
