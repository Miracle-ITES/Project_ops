"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface RequireAuthProps {
  children: ReactNode;
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
