"use client";

import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth-context";

function DashboardContent() {
  const { user, logout } = useAuth();

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <button onClick={() => logout()} className="text-sm text-gray-500 hover:text-gray-800">
          Sign out
        </button>
      </div>
      <p className="mt-4 text-sm text-gray-600">
        Signed in as <span className="font-medium">{user?.email}</span> — role{" "}
        <span className="font-medium">{user?.role.name}</span>
      </p>
      <p className="mt-2 text-xs text-gray-400">Permissions: {user?.role.permissions.join(", ")}</p>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
