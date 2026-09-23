"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, UserCog } from "lucide-react";
import { useParams } from "next/navigation";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { ApiError } from "@/lib/api-client";
import { getUser } from "@/lib/users-api";
import type { UserListItemOut } from "@/types/users";

function UserDetailContent() {
    const { userId } = useParams<{ userId: string }>();
    const [user, setUser] = useState<UserListItemOut | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        void getUser(userId)
            .then((loadedUser) => {
                if (!cancelled) setUser(loadedUser);
            })
            .catch((err) => {
                if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load user.");
            });

        return () => {
            cancelled = true;
        };
    }, [userId]);

    if (error) {
        return (
            <AppShell active="users" breadcrumb="User Not Found">
                <div className="p-gutter-lg"><p className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{error}</p></div>
            </AppShell>
        );
    }

    if (!user) {
        return (
            <AppShell active="users" breadcrumb="Loading...">
                <p className="p-gutter-lg text-sm text-on-surface-variant">Loading...</p>
            </AppShell>
        );
    }

    return (
        <AppShell active="users" breadcrumb={user.full_name || user.email}>
            <div className="max-w-3xl px-gutter-lg py-space-lg">
                <Link href="/users" className="mb-6 inline-flex items-center gap-2 font-label-md text-label-md text-on-surface-variant hover:text-on-surface">
                    <ArrowLeft size={16} aria-hidden="true" />
                    Users
                </Link>
                <section className="rounded-xl bg-surface-container-lowest p-6 shadow-sm">
                    <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-container text-on-primary">
                            <UserCog size={24} aria-hidden="true" />
                        </div>
                        <div>
                            <h1 className="font-headline-xl text-headline-xl font-bold text-on-surface">{user.full_name || user.email}</h1>
                            <p className="mt-1 font-body-md text-body-md text-on-surface-variant">{user.email}</p>
                        </div>
                    </div>
                    <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="rounded-lg bg-surface-container-low p-4"><dt className="font-label-sm text-label-sm uppercase tracking-wider text-outline">Role</dt><dd className="mt-2 font-title-sm text-title-sm font-semibold text-on-surface">{user.role.name}</dd></div>
                        <div className="rounded-lg bg-surface-container-low p-4"><dt className="font-label-sm text-label-sm uppercase tracking-wider text-outline">Status</dt><dd className="mt-2 font-title-sm text-title-sm font-semibold text-on-surface">{user.is_active ? "Active" : "Inactive"}</dd></div>
                    </dl>
                    <div className="mt-6"><h2 className="font-headline-md text-headline-md font-bold text-on-surface">Permissions</h2><div className="mt-3 flex flex-wrap gap-2">{user.role.permissions.map((permission) => <span key={permission} className="rounded-md bg-surface-container-low px-2 py-1 text-xs text-on-surface-variant">{permission}</span>)}</div></div>
                </section>
            </div>
        </AppShell>
    );
}

export default function UserDetailPage() {
    return (
        <RequireAuth permission="users:manage">
            <UserDetailContent />
        </RequireAuth>
    );
}
