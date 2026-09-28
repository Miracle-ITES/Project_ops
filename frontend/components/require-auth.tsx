"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface RequireAuthProps {
  children: ReactNode;
  permission?: string;
  anyPermissions?: string[];
}

export function RequireAuth({ children, permission, anyPermissions }: RequireAuthProps) {
  const { user, isLoading, hasPermission } = useAuth();
  const router = useRouter();
  const allowed = (!permission || hasPermission(permission))
    && (!anyPermissions || anyPermissions.some(hasPermission));

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!allowed) {
      router.replace("/");
    }
  }, [isLoading, user, allowed, router]);

  if (isLoading || !user) return null;
  if (!allowed) return null;

  return <>{children}</>;
}
