"use client";

import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth-context";

function ProfileContent() {
    const { user } = useAuth();
    if (!user) return null;

    return (
        <AppShell active="dashboard" breadcrumb="My Profile">
            <div className="max-w-3xl px-gutter-lg py-space-lg">
                <h1 className="font-headline-xl text-headline-xl font-bold text-on-surface">My Profile</h1>
                <p className="mt-1 font-body-md text-body-md text-on-surface-variant">Your profile details are managed by your first-login setup and administrators.</p>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        // add your save API call here
                    }}
                    className="mt-6 grid grid-cols-1 gap-4 rounded-xl bg-surface-container-lowest p-6 shadow-sm sm:grid-cols-2"
                >
                    {/* Full Name */}
                    <div className="min-w-0 rounded-lg bg-surface-container-low p-4">
                        <label className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
                            Full name *
                        </label>
                        <input
                            required
                            type="text"
                            defaultValue={user.full_name || ""}
                            className="mt-2 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm"
                            placeholder="Enter full name"
                        />
                    </div>

                    {/* Company */}
                    <div className="min-w-0 rounded-lg bg-surface-container-low p-4">
                        <label className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
                            Company *
                        </label>
                        <input
                            required
                            type="text"
                            defaultValue={user.company_name || ""}
                            className="mt-2 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm"
                            placeholder="Enter company name"
                        />
                    </div>

                    {/* Job Title */}
                    <div className="min-w-0 rounded-lg bg-surface-container-low p-4">
                        <label className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
                            Job title *
                        </label>
                        <input
                            required
                            type="text"
                            defaultValue={user.job_title || ""}
                            className="mt-2 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm"
                            placeholder="Enter job title"
                        />
                    </div>

                    {/* Department */}
                    <div className="min-w-0 rounded-lg bg-surface-container-low p-4">
                        <label className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
                            Department *
                        </label>

                        <select
                            required
                            defaultValue={user.department || ""}
                            className="mt-2 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm"
                        >
                            <option value="">Select department</option>
                            <option value="Engineering">Engineering</option>
                            <option value="Design">Design</option>
                            <option value="Marketing">Marketing</option>
                            <option value="HR">HR</option>
                        </select>
                    </div>

                    {/* Phone */}
                    <div className="min-w-0 rounded-lg bg-surface-container-low p-4">
                        <label className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
                            Phone *
                        </label>
                        <input
                            required
                            type="tel"
                            defaultValue={user.phone_number || ""}
                            className="mt-2 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm"
                            placeholder="Enter phone number"
                        />
                    </div>

                    {/* Location */}
                    <div className="min-w-0 rounded-lg bg-surface-container-low p-4">
                        <label className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
                            Location *
                        </label>
                        <input
                            required
                            type="text"
                            defaultValue={user.location || ""}
                            className="mt-2 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm"
                            placeholder="Enter location"
                        />
                    </div>

                    {/* Email - cannot edit */}
                    <div className="min-w-0 rounded-lg bg-surface-container-low p-4">
                        <label className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
                            Email *
                        </label>
                        <input
                            required
                            type="email"
                            value={user.email}
                            readOnly
                            className="mt-2 w-full rounded-lg border border-outline-variant bg-gray-100 px-3 py-2 text-sm"
                        />
                    </div>

                    {/* Role - managed by admin */}
                    <div className="min-w-0 rounded-lg bg-surface-container-low p-4">
                        <label className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
                            Role *
                        </label>
                        <input
                            required
                            type="text"
                            value={user.role?.name || ""}
                            readOnly
                            className="mt-2 w-full rounded-lg border border-outline-variant bg-gray-100 px-3 py-2 text-sm"
                        />
                    </div>

                    {/* Save */}
                    <div className="sm:col-span-2">
                        <button
                            type="submit"
                            className="rounded-lg bg-secondary px-5 py-2 text-sm font-semibold text-on-secondary"
                        >
                            Save Profile
                        </button>
                    </div>
                </form>
            </div>
        </AppShell>
    );
}

export default function ProfilePage() {
    return <RequireAuth><ProfileContent /></RequireAuth>;
}
