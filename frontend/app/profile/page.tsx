"use client";

import { useState, type FormEvent } from "react";
import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { updateUserProfile, type ProfileUpdate } from "@/lib/users-api";

function ProfileContent() {
    const { user, hasPermission, refreshUser } = useAuth();
    const canManageProfile = hasPermission("users:manage");
    const [fullName, setFullName] = useState(user?.full_name || "");
    const [companyName, setCompanyName] = useState(user?.company_name || "");
    const [jobTitle, setJobTitle] = useState(user?.job_title || "");
    const [department, setDepartment] = useState(user?.department || "");
    const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || "");
    const [location, setLocation] = useState(user?.location || "");
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    if (!user) return null;

    async function saveProfile(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!user || !canManageProfile) return;
        setError(null);
        setIsSaving(true);
        try {
            const payload: ProfileUpdate = {
                full_name: fullName,
                company_name: companyName,
                job_title: jobTitle,
                department,
                phone_number: phoneNumber,
                location,
            };
            await updateUserProfile(user.id, payload);
            await refreshUser();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Could not save profile.");
        } finally {
            setIsSaving(false);
        }
    }

    const fieldClass = "mt-2 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm disabled:bg-surface-container-low disabled:text-on-surface-variant";
    return (
        <AppShell active="dashboard" breadcrumb="My Profile">
            <div className="max-w-3xl px-gutter-lg py-space-lg">
                <h1 className="font-headline-xl text-headline-xl font-bold text-on-surface">My Profile</h1>
                <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
                    {canManageProfile
                        ? "Administrators can update profile details, including after first-login setup."
                        : "Your profile is locked after first-login setup. Contact an administrator to change these details."}
                </p>
                {error && <p className="mt-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{error}</p>}
                <form onSubmit={saveProfile} className="mt-6 grid grid-cols-1 gap-4 rounded-xl bg-surface-container-lowest p-6 shadow-sm sm:grid-cols-2">
                    <label className="min-w-0 rounded-lg bg-surface-container-low p-4 text-xs font-semibold uppercase tracking-wider text-outline">
                        Full name
                        <input required value={fullName} onChange={(event) => setFullName(event.target.value)} disabled={!canManageProfile || isSaving} className={fieldClass} />
                    </label>
                    <label className="min-w-0 rounded-lg bg-surface-container-low p-4 text-xs font-semibold uppercase tracking-wider text-outline">
                        Company
                        <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} disabled={!canManageProfile || isSaving} className={fieldClass} />
                    </label>
                    <label className="min-w-0 rounded-lg bg-surface-container-low p-4 text-xs font-semibold uppercase tracking-wider text-outline">
                        Job title
                        <input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} disabled={!canManageProfile || isSaving} className={fieldClass} />
                    </label>
                    <label className="min-w-0 rounded-lg bg-surface-container-low p-4 text-xs font-semibold uppercase tracking-wider text-outline">
                        Department
                        <input value={department} onChange={(event) => setDepartment(event.target.value)} disabled={!canManageProfile || isSaving} className={fieldClass} />
                    </label>
                    <label className="min-w-0 rounded-lg bg-surface-container-low p-4 text-xs font-semibold uppercase tracking-wider text-outline">
                        Phone
                        <input type="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} disabled={!canManageProfile || isSaving} className={fieldClass} />
                    </label>
                    <label className="min-w-0 rounded-lg bg-surface-container-low p-4 text-xs font-semibold uppercase tracking-wider text-outline">
                        Location
                        <input value={location} onChange={(event) => setLocation(event.target.value)} disabled={!canManageProfile || isSaving} className={fieldClass} />
                    </label>
                    <label className="min-w-0 rounded-lg bg-surface-container-low p-4 text-xs font-semibold uppercase tracking-wider text-outline">
                        Email
                        <input value={user.email} readOnly className={`${fieldClass} bg-surface-container-low`} />
                    </label>
                    <label className="min-w-0 rounded-lg bg-surface-container-low p-4 text-xs font-semibold uppercase tracking-wider text-outline">
                        Role
                        <input value={user.role.name} readOnly className={`${fieldClass} bg-surface-container-low`} />
                    </label>
                    {canManageProfile && <div className="sm:col-span-2">
                        <button type="submit" disabled={isSaving} className="rounded-lg bg-secondary px-5 py-2 text-sm font-semibold text-on-secondary disabled:opacity-50">
                            {isSaving ? "Saving..." : "Save profile"}
                        </button>
                    </div>}
                </form>
            </div>
        </AppShell>
    );
}

export default function ProfilePage() {
    return <RequireAuth><ProfileContent /></RequireAuth>;
}
