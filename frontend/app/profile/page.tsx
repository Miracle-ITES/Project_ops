"use client";

import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth-context";

function ProfileContent() {
    const { user } = useAuth();
    if (!user) return null;

    const details = [
        ["Full name", user.full_name],
        ["Company", user.company_name],
        ["Job title", user.job_title],
        ["Department", user.department],
        ["Phone", user.phone_number],
        ["Location", user.location],
        ["Email", user.email],
        ["Role", user.role.name],
    ];

    return (
        <AppShell active="dashboard" breadcrumb="My Profile">
            <div className="max-w-3xl px-gutter-lg py-space-lg">
                <h1 className="font-headline-xl text-headline-xl font-bold text-on-surface">My Profile</h1>
                <p className="mt-1 font-body-md text-body-md text-on-surface-variant">Your profile details are managed by your first-login setup and administrators.</p>
                <section className="mt-6 grid grid-cols-1 gap-4 rounded-xl bg-surface-container-lowest p-6 shadow-sm sm:grid-cols-2">
                    {details.map(([label, value]) => <div key={label} className="min-w-0 rounded-lg bg-surface-container-low p-4"><dt className="font-label-sm text-label-sm uppercase tracking-wider text-outline">{label}</dt><dd className="mt-2 break-words font-title-sm text-title-sm font-semibold text-on-surface">{value || "Not provided"}</dd></div>)}
                </section>
            </div>
        </AppShell>
    );
}

export default function ProfilePage() {
    return <RequireAuth><ProfileContent /></RequireAuth>;
}
