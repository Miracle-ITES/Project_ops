"use client";

import { useCallback, useEffect, useState, type SubmitEventHandler } from "react";
import Link from "next/link";
import { Plus, UserCog } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { Dialog } from "../../components/dialog";
import { ApiError } from "@/lib/api-client";
import { changeUserRole, createUser, listUsers, setUserActive } from "@/lib/users-api";
import type { UserListItemOut } from "@/types/users";

const ROLE_OPTIONS = ["Administrator", "Lead/Manager", "Member", "Viewer/Auditor"];

function UsersContent() {
    const [users, setUsers] = useState<UserListItemOut[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fullName, setFullName] = useState("");
    const [roleName, setRoleName] = useState("Member");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            setUsers(await listUsers());
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Failed to load users.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        queueMicrotask(() => {
            if (!cancelled) void load();
        });

        return () => {
            cancelled = true;
        };
    }, [load]);

    const handleCreate: SubmitEventHandler<HTMLFormElement> = async (event) => {
        event.preventDefault();
        setError(null);
        setIsSubmitting(true);
        try {
            await createUser({ email, password, full_name: fullName || undefined, role_name: roleName });
            setEmail("");
            setPassword("");
            setFullName("");
            setRoleName("Member");
            setShowForm(false);
            await load();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Failed to create user.");
        } finally {
            setIsSubmitting(false);
        }
    };

    async function handleRoleChange(userId: string, nextRole: string) {
        setError(null);
        try {
            const updated = await changeUserRole(userId, nextRole);
            setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Failed to change user role.");
        }
    }

    async function handleActiveChange(userId: string, isActive: boolean) {
        setError(null);
        try {
            const updated = await setUserActive(userId, isActive);
            setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Failed to update user status.");
        }
    }

    return (
        <AppShell active="users" breadcrumb="User Administration">
            <div className="px-gutter-lg py-space-lg">
                <div className="mb-space-lg flex flex-col justify-between gap-space-md lg:flex-row lg:items-center">
                    <div>
                        <h1 className="font-headline-xl text-headline-xl font-bold tracking-tight text-on-surface">Users &amp; Access</h1>
                        <p className="mt-0.5 font-body-md text-body-md text-on-surface-variant">Provision accounts and manage access levels.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setError(null);
                            setShowForm(true);
                        }}
                        className="inline-flex items-center gap-1.5 self-start rounded-lg bg-primary px-3.5 py-1.5 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-all hover:bg-primary-container"
                    >
                        <Plus size={18} aria-hidden="true" />
                        New User
                    </button>
                </div>

                {error && <p className="mb-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{error}</p>}

                <div className="mb-space-lg grid grid-cols-1 gap-space-md sm:grid-cols-3">
                    <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sm">
                        <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-outline">Total Users</span>
                        <div className="mt-3 font-display-lg text-display-lg font-bold tracking-tight text-on-surface">{isLoading ? "..." : users.length}</div>
                    </div>
                    <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sm">
                        <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-outline">Active Accounts</span>
                        <div className="mt-3 font-display-lg text-display-lg font-bold tracking-tight text-secondary">{isLoading ? "..." : users.filter((user) => user.is_active).length}</div>
                    </div>
                    <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sm">
                        <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-outline">Administrators</span>
                        <div className="mt-3 font-display-lg text-display-lg font-bold tracking-tight text-on-surface">{isLoading ? "..." : users.filter((user) => user.role.name === "Administrator").length}</div>
                    </div>
                </div>

                {showForm && (
                    <Dialog title="Create user" description="Provision an account with an initial access role." onClose={() => setShowForm(false)}>
                        <form onSubmit={handleCreate} className="space-y-3">
                            <input required type="email" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none" />
                            <input required minLength={8} type="password" placeholder="Temporary password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none" />
                            <input placeholder="Full name (optional)" value={fullName} onChange={(event) => setFullName(event.target.value)} className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none" />
                            <select value={roleName} onChange={(event) => setRoleName(event.target.value)} className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none">
                                {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
                            </select>
                            <button type="submit" disabled={isSubmitting} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-container disabled:opacity-50">
                                {isSubmitting ? "Creating..." : "Create user"}
                            </button>
                        </form>
                    </Dialog>
                )}

                <div className="overflow-x-auto rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
                    <table className="w-full min-w-180 text-left font-body-md text-body-md">
                        <thead>
                            <tr className="bg-surface-container-low/50 font-label-sm text-label-sm uppercase tracking-wider text-outline">
                                <th className="rounded-l-md px-3 py-2.5">User</th>
                                <th className="px-3 py-2.5">Role</th>
                                <th className="px-3 py-2.5">Status</th>
                                <th className="rounded-r-md px-3 py-2.5">Account</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={4} className="px-3 py-6 text-on-surface-variant">Loading...</td></tr>
                            ) : users.length === 0 ? (
                                <tr><td colSpan={4} className="px-3 py-6 text-on-surface-variant">No users yet.</td></tr>
                            ) : users.map((user) => (
                                <tr key={user.id} className="border-t border-outline-variant/40 hover:bg-surface-container-low/50">
                                    <td className="px-3 py-3">
                                        <Link href={`/users/${user.id}`} className="flex items-center gap-2 hover:text-secondary">
                                            <UserCog size={18} className="text-secondary" aria-hidden="true" />
                                            <span><span className="block font-semibold text-on-surface">{user.full_name || user.email}</span><span className="block text-xs text-on-surface-variant">{user.email}</span></span>
                                        </Link>
                                    </td>
                                    <td className="px-3 py-3">
                                        <select value={user.role.name} onChange={(event) => void handleRoleChange(user.id, event.target.value)} className="rounded-lg border border-outline-variant bg-transparent px-2 py-1 text-sm focus:border-secondary focus:outline-none">
                                            {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-3 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${user.is_active ? "bg-secondary-container/60 text-on-secondary-container" : "bg-error-container text-on-error-container"}`}>{user.is_active ? "Active" : "Inactive"}</span></td>
                                    <td className="px-3 py-3"><button type="button" onClick={() => void handleActiveChange(user.id, !user.is_active)} className="font-label-sm text-label-sm text-on-surface-variant hover:text-secondary">{user.is_active ? "Deactivate" : "Activate"}</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </AppShell>
    );
}

export default function UsersPage() {
    return (
        <RequireAuth permission="users:manage">
            <UsersContent />
        </RequireAuth>
    );
}
