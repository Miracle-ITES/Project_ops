"use client";

import { useCallback, useEffect, useMemo, useState, type SubmitEventHandler } from "react";
import Link from "next/link";
import { Plus, UserCog } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { Dialog } from "../../components/dialog";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { approveInvitationRequest, changeUserRole, createUser, listInvitationRequests, listMyInvitationRequests, listUsers, rejectInvitationRequest, requestUser, setUserActive } from "@/lib/users-api";
import { listMyTeamMembers } from "@/lib/teams-api";
import type { InvitationRequestOut, UserListItemOut } from "@/types/users";
import type { MyTeamMemberOut } from "@/types/teams";

const ROLE_OPTIONS = ["Administrator", "Lead/Manager", "Member", "Viewer/Auditor"];

function UsersContent() {
    const { hasPermission } = useAuth();
    const canManageUsers = hasPermission("users:manage");
    const canRequestUsers = hasPermission("users:request");
    const canViewTeamRoster = hasPermission("teams:view_own_roster");
    const [users, setUsers] = useState<UserListItemOut[]>([]);
    const [requests, setRequests] = useState<InvitationRequestOut[]>([]);
    const [teamMembers, setTeamMembers] = useState<MyTeamMemberOut[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [showAllUsers, setShowAllUsers] = useState(false);
    const [requestDateFilter, setRequestDateFilter] = useState("all");
    const [showAllPendingRequests, setShowAllPendingRequests] = useState(false);
    const [showAllRequestHistory, setShowAllRequestHistory] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [email, setEmail] = useState("");
    const [fullName, setFullName] = useState("");
    const [roleName, setRoleName] = useState("Member");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [loadedUsers, loadedRequests, loadedTeamMembers] = await Promise.all([
                canManageUsers ? listUsers() : Promise.resolve([]),
                canManageUsers ? listInvitationRequests() : canRequestUsers ? listMyInvitationRequests() : Promise.resolve([]),
                canViewTeamRoster ? listMyTeamMembers() : Promise.resolve([]),
            ]);
            setUsers(loadedUsers);
            setRequests(loadedRequests);
            setTeamMembers(loadedTeamMembers);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Failed to load users.");
        } finally {
            setIsLoading(false);
        }
    }, [canManageUsers, canRequestUsers, canViewTeamRoster]);

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
            if (canManageUsers) {
                await createUser({ email, full_name: fullName || undefined, role_name: roleName });
            } else {
                await requestUser({ email, full_name: fullName || undefined, role_name: roleName });
            }
            setEmail("");
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

    async function reviewRequest(request: InvitationRequestOut, approved: boolean) {
        setError(null);
        try {
            if (approved) {
                await approveInvitationRequest(request.id);
            } else {
                await rejectInvitationRequest(request.id);
            }
            setRequests((current) => current.filter((item) => item.id !== request.id));
            if (approved) await load();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Failed to review invitation request.");
        }
    }

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

    const uniqueTeamMembers = useMemo(() => Array.from(new Map(teamMembers.map((member) => [member.user_id, member])).values()), [teamMembers]);
    const pendingRequests = requests.filter((request) => request.status === "pending").length;
    const approvedRequests = requests.filter((request) => request.status === "approved").length;
    const filteredUsers = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return users;
        return users.filter((user) => [user.full_name, user.email, user.role.name, user.is_active ? "active" : "inactive"]
            .some((value) => value?.toLowerCase().includes(query)));
    }, [users, search]);
    const filteredTeamMembers = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return uniqueTeamMembers;
        return uniqueTeamMembers.filter((member) => [member.full_name, member.email, member.role_name, member.team_names.join(" "), member.is_active ? "active" : "inactive"]
            .some((value) => value?.toLowerCase().includes(query)));
    }, [uniqueTeamMembers, search]);
    const filteredRequests = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return requests;
        return requests.filter((request) => [request.full_name, request.email, request.role_name, request.status]
            .some((value) => value?.toLowerCase().includes(query)));
    }, [requests, search]);
    const dateFilteredRequests = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        const weekStart = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
        return requests.filter((request) => {
            const created = new Date(request.created_at);
            return requestDateFilter === "today" ? created >= today
                : requestDateFilter === "yesterday" ? created >= yesterday && created < today
                    : requestDateFilter === "7days" ? created >= weekStart : true;
        });
    }, [requests, requestDateFilter]);
    const pendingRequestsList = dateFilteredRequests.filter((request) => request.status === "pending");
    const visiblePendingRequests = showAllPendingRequests ? pendingRequestsList : pendingRequestsList.slice(0, 5);
    const visibleRequestHistory = showAllRequestHistory ? dateFilteredRequests : dateFilteredRequests.slice(0, 5);
    const tableCount = canManageUsers ? filteredUsers.length : canViewTeamRoster ? filteredTeamMembers.length : filteredRequests.length;
    const shouldShowAll = showAllUsers;

    return (
        <AppShell active="users" breadcrumb="User Administration">
            <div className="px-4 sm:px-gutter-lg py-space-lg">
                <div className="mb-space-lg flex flex-col justify-between gap-space-md lg:flex-row lg:items-center">
                    <div>
                        <h1 className="font-headline-xl text-headline-xl font-bold tracking-tight text-on-surface">Users &amp; Access</h1>
                        <p className="mt-0.5 font-body-md text-body-md text-on-surface-variant">{canManageUsers ? "Invite members by email and manage access levels." : canRequestUsers ? "Request new users for administrator approval and follow your requests and team roster." : "View members and access information for your teams."}</p>
                    </div>
                    {canRequestUsers && <button
                        type="button"
                        onClick={() => {
                            setError(null);
                            setShowForm(true);
                        }}
                        className="inline-flex items-center gap-1.5 self-start rounded-lg bg-primary px-3.5 py-1.5 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-all hover:bg-primary-container"
                    >
                        <Plus size={18} aria-hidden="true" />
                        {canManageUsers ? "New User" : "Request User"}
                    </button>}
                </div>

                {error && <p className="mb-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{error}</p>}

                <div className="mb-space-lg grid grid-cols-1 gap-space-md sm:grid-cols-3">
                    <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sm">
                        <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-outline">{canManageUsers ? "Total Users" : canViewTeamRoster ? "Team Members" : "Users Requested"}</span>
                        <div className="mt-3 font-display-lg text-display-lg font-bold tracking-tight text-on-surface">{isLoading ? "..." : canManageUsers ? users.length : canViewTeamRoster ? uniqueTeamMembers.length : requests.length}</div>
                    </div>
                    <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sm">
                        <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-outline">{canManageUsers ? "Active Accounts" : canViewTeamRoster ? "Pending Requests" : "Approved"}</span>
                        <div className="mt-3 font-display-lg text-display-lg font-bold tracking-tight text-secondary">{isLoading ? "..." : canManageUsers ? users.filter((user) => user.is_active).length : canViewTeamRoster ? pendingRequests : approvedRequests}</div>
                    </div>
                    <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sm">
                        <span className="font-label-sm text-label-sm font-semibold uppercase tracking-wider text-outline">{canManageUsers ? "Administrators" : canViewTeamRoster ? "Approved Requests" : "Pending"}</span>
                        <div className="mt-3 font-display-lg text-display-lg font-bold tracking-tight text-on-surface">{isLoading ? "..." : canManageUsers ? users.filter((user) => user.role.name === "Administrator").length : canViewTeamRoster ? approvedRequests : pendingRequests}</div>
                    </div>
                </div>

                {showForm && (
                    <Dialog title={canManageUsers ? "Invite user" : "Request user"} description={canManageUsers ? "This sends the invitation email immediately." : "An administrator must approve this request before any email is sent."} onClose={() => setShowForm(false)}>
                        <form onSubmit={handleCreate} className="space-y-3">
                            <input required type="email" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none" />
                            <input placeholder="Full name (optional)" value={fullName} onChange={(event) => setFullName(event.target.value)} className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none" />
                            <select value={roleName} onChange={(event) => setRoleName(event.target.value)} className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none">
                                {ROLE_OPTIONS.filter((role) => canManageUsers || role !== "Administrator").map((role) => <option key={role} value={role}>{role}</option>)}
                            </select>
                            <button type="submit" disabled={isSubmitting} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-container disabled:opacity-50">
                                {isSubmitting ? "Submitting..." : canManageUsers ? "Send invitation" : "Submit for approval"}
                            </button>
                        </form>
                    </Dialog>
                )}

                {(canManageUsers && requests.length > 0 || canRequestUsers && !canManageUsers && requests.length > 0) && <label className="mb-space-md block max-w-xs text-xs font-semibold text-outline">
                    Filter requests by date
                    <select value={requestDateFilter} onChange={(event) => { setRequestDateFilter(event.target.value); setShowAllPendingRequests(false); setShowAllRequestHistory(false); }} className="mt-1 block w-full rounded-lg border border-outline-variant px-3 py-2 text-sm font-normal text-on-surface focus:border-secondary focus:outline-none">
                        <option value="all">All dates</option>
                        <option value="today">Today</option>
                        <option value="yesterday">Yesterday</option>
                        <option value="7days">Last 7 days</option>
                    </select>
                </label>}

                {canManageUsers && pendingRequestsList.length > 0 && <section className="mb-space-lg rounded-xl bg-surface-container-lowest p-space-md shadow-sm"><h2 className="font-headline-md font-bold text-on-surface">Pending user approvals</h2><div className="mt-3 space-y-2">{visiblePendingRequests.map((request) => <div key={request.id} className="flex flex-col gap-3 border-t border-outline-variant/40 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-on-surface">{request.full_name || request.email}</p><p className="text-xs text-on-surface-variant">{request.email} · {request.role_name} · requested by {request.requested_by_name || "team lead"}</p></div><div className="flex gap-2"><button type="button" onClick={() => void reviewRequest(request, false)} className="rounded-lg border border-error px-3 py-1.5 text-xs font-semibold text-error">Reject</button><button type="button" onClick={() => void reviewRequest(request, true)} className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-on-secondary">Approve &amp; email</button></div></div>)}</div>{pendingRequestsList.length > 5 && <button type="button" onClick={() => setShowAllPendingRequests((current) => !current)} className="mt-4 rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:border-secondary hover:text-secondary">{showAllPendingRequests ? "Show recent 5" : `View all ${pendingRequestsList.length} pending requests`}</button>}</section>}

                {canManageUsers && requests.length > 0 && <section className="mb-space-lg rounded-xl bg-surface-container-lowest p-space-md shadow-sm"><div className="flex flex-wrap gap-3"><span className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900">Request: {requests.filter((request) => request.status === "pending").length}</span><span className="rounded-lg bg-secondary-container/60 px-3 py-2 text-xs font-semibold text-on-secondary-container">Approved: {requests.filter((request) => request.status === "approved").length}</span><span className="rounded-lg bg-surface-container-high px-3 py-2 text-xs font-semibold text-on-surface-variant">New user: {requests.filter((request) => request.status === "approved").length}</span></div><div className="mt-3 space-y-2">{visibleRequestHistory.map((request) => <div key={request.id} className="flex flex-col gap-1 border-t border-outline-variant/40 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="break-all text-on-surface">{request.full_name || request.email}</span><span className="text-xs font-semibold capitalize text-on-surface-variant">{request.status}</span></div>)}</div>{dateFilteredRequests.length > 5 && <button type="button" onClick={() => setShowAllRequestHistory((current) => !current)} className="mt-4 rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:border-secondary hover:text-secondary">{showAllRequestHistory ? "Show recent 5" : `View all ${dateFilteredRequests.length} requests`}</button>}</section>}

                {canRequestUsers && !canManageUsers && requests.length > 0 && <section className="mb-space-lg rounded-xl bg-surface-container-lowest p-space-md shadow-sm"><h2 className="font-headline-md font-bold text-on-surface">Your user requests</h2><div className="mt-3 space-y-2">{visibleRequestHistory.map((request) => <div key={request.id} className="flex flex-col gap-1 border-t border-outline-variant/40 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="break-all text-on-surface">{request.full_name || request.email}</span><span className="text-xs font-semibold capitalize text-on-surface-variant">{request.status}</span></div>)}</div>{dateFilteredRequests.length > 5 && <button type="button" onClick={() => setShowAllRequestHistory((current) => !current)} className="mt-4 rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:border-secondary hover:text-secondary">{showAllRequestHistory ? "Show recent 5" : `View all ${dateFilteredRequests.length} requests`}</button>}</section>}

                <div className="overflow-x-auto rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
                    {canViewTeamRoster && <div className="mb-3">
                        <h2 className="font-headline-md font-bold text-on-surface">Members of your teams</h2>
                        <p className="mt-1 text-sm text-on-surface-variant">Approved user requests are not added to a team automatically; team membership is managed separately.</p>
                    </div>}
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <label className="block w-full max-w-xl text-xs font-semibold text-outline">
                            Search users
                            <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setShowAllUsers(false); }} placeholder="Search name, email, role, or team" className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm font-normal text-on-surface focus:border-secondary focus:outline-none" />
                        </label>
                        <span className="text-xs text-on-surface-variant">{tableCount} {tableCount === 1 ? "user" : "users"}</span>
                    </div>
                    <table className="w-full min-w-180 text-left font-body-md text-body-md">
                        <thead>
                            <tr className="bg-surface-container-low/50 font-label-sm text-label-sm uppercase tracking-wider text-outline">
                                <th className="rounded-l-md px-3 py-2.5">User</th>
                                <th className="px-3 py-2.5">Role</th>
                                <th className="px-3 py-2.5">Status</th>
                                <th className="rounded-r-md px-3 py-2.5">{canViewTeamRoster ? "Team" : "Account"}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={4} className="px-3 py-6 text-on-surface-variant">Loading...</td></tr>
                            ) : canManageUsers ? filteredUsers.length === 0 ? (
                                <tr><td colSpan={4} className="px-3 py-6 text-on-surface-variant">{users.length ? "No users match your search." : "No users yet."}</td></tr>
                            ) : filteredUsers.slice(0, shouldShowAll ? undefined : 10).map((user) => (
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
                            )) : canViewTeamRoster ? filteredTeamMembers.length === 0 ? (
                                <tr><td colSpan={4} className="px-3 py-6 text-on-surface-variant"><p>No members are listed for your teams yet.</p><p className="mt-1 text-xs">Once a user is added to a team you belong to, they will appear here.</p><Link href="/teams" className="mt-2 inline-block text-sm font-semibold text-secondary hover:underline">View teams</Link></td></tr>
                            ) : filteredTeamMembers.slice(0, shouldShowAll ? undefined : 10).map((member) => (
                                <tr key={member.user_id} className="border-t border-outline-variant/40">
                                    <td className="px-3 py-3"><span className="block font-semibold text-on-surface">{member.full_name || member.email}</span><span className="block text-xs text-on-surface-variant">{member.email}</span></td>
                                    <td className="px-3 py-3">{member.role_name}</td>
                                    <td className="px-3 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${member.is_active ? "bg-secondary-container/60 text-on-secondary-container" : "bg-error-container text-on-error-container"}`}>{member.is_active ? "Active" : "Inactive"}</span></td>
                                    <td className="px-3 py-3 text-on-surface-variant">{member.team_names.join(", ")}</td>
                                </tr>
                            )) : filteredRequests.length === 0 ? (
                                <tr><td colSpan={4} className="px-3 py-6 text-on-surface-variant">{requests.length ? "No users match your search." : "You have not requested any users yet."}</td></tr>
                            ) : filteredRequests.slice(0, shouldShowAll ? undefined : 10).map((request) => (
                                <tr key={request.id} className="border-t border-outline-variant/40">
                                    <td className="px-3 py-3"><span className="block font-semibold text-on-surface">{request.full_name || request.email}</span><span className="block text-xs text-on-surface-variant">{request.email}</span></td>
                                    <td className="px-3 py-3">{request.role_name}</td>
                                    <td className="px-3 py-3"><span className="font-semibold capitalize text-on-surface-variant">{request.status}</span></td>
                                    <td className="px-3 py-3 text-on-surface-variant">{request.status === "approved" ? "Invitation sent" : request.status === "pending" ? "Awaiting approval" : "Not created"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {tableCount > 10 && <div className="mt-4 flex justify-center">
                        <button type="button" onClick={() => setShowAllUsers((current) => !current)} className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:border-secondary hover:text-secondary">
                            {showAllUsers ? "Show recent 10" : `View all ${tableCount} users`}
                        </button>
                    </div>}
                </div>
            </div>
        </AppShell>
    );
}

export default function UsersPage() {
    return (
        <RequireAuth>
            <UsersContent />
        </RequireAuth>
    );
}
