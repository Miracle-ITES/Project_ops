"use client";

import { useEffect, useState, type SubmitEventHandler } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, UserCog } from "lucide-react";
import { useParams } from "next/navigation";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { ApiError } from "@/lib/api-client";
import { changeUserPassword, changeUserRole, getUser, setUserActive, updateUserProfile } from "@/lib/users-api";
import type { UserListItemOut } from "@/types/users";

const ROLE_OPTIONS = ["Administrator", "Lead/Manager", "Member", "Viewer/Auditor"];

function UserDetailContent() {
    const { userId } = useParams<{ userId: string }>();
    const [user, setUser] = useState<UserListItemOut | null>(null);
    const [fullName, setFullName] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [jobTitle, setJobTitle] = useState("");
    const [department, setDepartment] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [location, setLocation] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isAccessSaving, setIsAccessSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        void getUser(userId)
            .then((loadedUser) => {
                if (!cancelled) {
                    setUser(loadedUser);
                    setFullName(loadedUser.full_name || "");
                    setCompanyName(loadedUser.company_name || "");
                    setJobTitle(loadedUser.job_title || "");
                    setDepartment(loadedUser.department || "");
                    setPhoneNumber(loadedUser.phone_number || "");
                    setLocation(loadedUser.location || "");
                }
            })
            .catch((err) => {
                if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load user.");
            });

        return () => {
            cancelled = true;
        };
    }, [userId]);

    const handleProfileUpdate: SubmitEventHandler<HTMLFormElement> = async (event) => {
        event.preventDefault();
        setError(null);
        setIsSaving(true);
        try {
            setUser(await updateUserProfile(userId, {
                full_name: fullName, company_name: companyName, job_title: jobTitle,
                department, phone_number: phoneNumber, location,
            }));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Failed to update profile.");
        } finally {
            setIsSaving(false);
        }
    };

    async function handleRoleChange(roleName: string) {
        setError(null);
        setIsAccessSaving(true);
        try {
            setUser(await changeUserRole(userId, roleName));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Failed to update access role.");
        } finally {
            setIsAccessSaving(false);
        }
    }

    async function handleActiveChange() {
        if (!user) return;
        setError(null);
        setIsAccessSaving(true);
        try {
            setUser(await setUserActive(userId, !user.is_active));
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Failed to update account access.");
        } finally {
            setIsAccessSaving(false);
        }
    }

    const handlePasswordChange: SubmitEventHandler<HTMLFormElement> = async (event) => {
        event.preventDefault();
        setPasswordError(null);
        setPasswordMessage(null);
        if (password !== confirmPassword) {
            setPasswordError("Passwords do not match.");
            return;
        }
        setIsAccessSaving(true);
        try {
            await changeUserPassword(userId, password);
            setPassword("");
            setConfirmPassword("");
            setPasswordMessage("Password updated. The user will need to sign in again.");
        } catch (err) {
            setPasswordError(err instanceof ApiError ? err.message : err instanceof Error ? `Could not reach the API: ${err.message}` : "Failed to update password.");
        } finally {
            setIsAccessSaving(false);
        }
    };

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
                    <form onSubmit={handleProfileUpdate} className="mt-6 border-t border-outline-variant/40 pt-6">
                        <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Profile</h2>
                        <p className="mt-1 text-sm text-on-surface-variant">Administrators can update profile details after the first-login lock.</p>
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <input required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Full name" className="min-w-0 rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none" />
                            <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Company name" className="min-w-0 rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none" />
                            <input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="Job title" className="min-w-0 rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none" />
                            <input value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="Department" className="min-w-0 rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none" />
                            <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="Phone number" className="min-w-0 rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none" />
                            <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location" className="min-w-0 rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none" />
                            <button type="submit" disabled={isSaving} className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-50 sm:col-span-2">{isSaving ? "Saving..." : "Save profile"}</button>
                        </div>
                    </form>
                    <form onSubmit={handlePasswordChange} className="mt-6 border-t border-outline-variant/40 pt-6">
                        <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Change password</h2>
                        <p className="mt-1 text-sm text-on-surface-variant">Set a new password for this account. Existing sessions will expire and need to sign in again.</p>
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="relative">
                                <input type={showPassword ? "text" : "password"} required minLength={8} maxLength={72} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" className="w-full min-w-0 rounded-lg border border-outline-variant py-2 pl-3 pr-10 text-sm focus:border-secondary focus:outline-none" />
                                <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide new password" : "Show new password"} aria-pressed={showPassword} className="absolute inset-y-0 right-0 flex items-center px-3 text-on-surface-variant hover:text-secondary">
                                    {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                                </button>
                            </div>
                            <div className="relative">
                                <input type={showConfirmPassword ? "text" : "password"} required minLength={8} maxLength={72} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm new password" className="w-full min-w-0 rounded-lg border border-outline-variant py-2 pl-3 pr-10 text-sm focus:border-secondary focus:outline-none" />
                                <button type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"} aria-pressed={showConfirmPassword} className="absolute inset-y-0 right-0 flex items-center px-3 text-on-surface-variant hover:text-secondary">
                                    {showConfirmPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                                </button>
                            </div>
                            <button type="submit" disabled={isAccessSaving} className="w-full rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-on-secondary disabled:opacity-50 sm:col-span-2">{isAccessSaving ? "Updating..." : "Update password"}</button>
                        </div>
                        {passwordError && <p role="alert" className="mt-3 text-sm text-error">{passwordError}</p>}
                        {passwordMessage && <p role="status" className="mt-3 text-sm text-secondary">{passwordMessage}</p>}
                    </form>
                    {user.role.name !== "Administrator" && <section className="mt-6 border-t border-outline-variant/40 pt-6">
                        <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Access management</h2>
                        <p className="mt-1 text-sm text-on-surface-variant">Change this account&apos;s role or suspend access.</p>
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <select value={user.role.name} disabled={isAccessSaving} onChange={(event) => void handleRoleChange(event.target.value)} className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:border-secondary focus:outline-none">
                                {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}
                            </select>
                            <button type="button" disabled={isAccessSaving} onClick={() => void handleActiveChange()} className="w-full rounded-lg border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface hover:border-secondary hover:text-secondary disabled:opacity-50">{user.is_active ? "Deactivate account" : "Activate account"}</button>
                        </div>
                    </section>}
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
