"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";
import { Dialog } from "@/components/dialog";
import { useAuth } from "@/lib/auth-context";
import { createLearning, deleteLearning, listDailyUpdates, listLearning, submitDailyUpdate, updateLearning } from "@/lib/work-api";
import type { DailyUpdate, LearningItem, LearningStatus } from "@/types/work";

export default function UpdatesPage() {
    const { hasPermission } = useAuth();
    const canManageLearning = hasPermission("projects:create");
    const canViewLearning = hasPermission("projects:view")
        || hasPermission("projects:view_assigned")
        || hasPermission("learning:submit");
    const canSubmitUpdates = hasPermission("daily_updates:submit");
    const today = new Date().toISOString().slice(0, 10);
    const [updates, setUpdates] = useState<DailyUpdate[]>([]);
    const [selectedUpdate, setSelectedUpdate] = useState<DailyUpdate | null>(null);
    const [learning, setLearning] = useState<LearningItem[]>([]);
    const [summary, setSummary] = useState("");
    const [accomplishments, setAccomplishments] = useState("");
    const [plans, setPlans] = useState("");
    const [blockers, setBlockers] = useState("");
    const [updateDate, setUpdateDate] = useState(today);
    const [topic, setTopic] = useState("");
    const [sessionDate, setSessionDate] = useState(today);
    const [editingLearningId, setEditingLearningId] = useState<string | null>(null);
    const [editTopic, setEditTopic] = useState("");
    const [editSessionDate, setEditSessionDate] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const reload = useCallback(async () => {
        try {
            const updatePage = await listDailyUpdates();
            setUpdates(updatePage.items);
            if (canViewLearning) {
                const learningPage = await listLearning();
                setLearning(learningPage.items);
            }
        } catch {
            setError("Could not load updates.");
        }
    }, [canViewLearning]);
    useEffect(() => { queueMicrotask(() => void reload()); }, [reload]);
    async function submit(event: React.FormEvent) {
        event.preventDefault();
        setError(null);
        setIsSubmitting(true);
        try {
            await submitDailyUpdate({
                update_date: updateDate,
                summary,
                accomplishments: accomplishments || undefined,
                plans: plans || undefined,
                blockers: blockers || undefined,
            });
            setSummary("");
            setAccomplishments("");
            setPlans("");
            setBlockers("");
            await reload();
        } catch {
            setError("Could not submit update.");
        } finally {
            setIsSubmitting(false);
        }
    }
    async function addLearning(event: React.FormEvent) {
        event.preventDefault();
        try {
            await createLearning({ topic, session_date: sessionDate });
            setTopic(""); await reload();
        } catch {
            setError("Could not add learning item.");
        }
    }
    function startEditingLearning(item: LearningItem) {
        setEditingLearningId(item.id);
        setEditTopic(item.topic);
        setEditSessionDate(item.session_date || "");
    }
    async function saveLearning(event: React.FormEvent<HTMLFormElement>, itemId: string) {
        event.preventDefault();
        try {
            await updateLearning(itemId, { topic: editTopic.trim(), session_date: editSessionDate || null });
            setEditingLearningId(null);
            await reload();
        } catch {
            setError("Could not update learning item.");
        }
    }
    async function removeLearning(item: LearningItem) {
        if (!window.confirm(`Delete the KT session “${item.topic}”?`)) return;
        try {
            await deleteLearning(item.id);
            if (editingLearningId === item.id) setEditingLearningId(null);
            await reload();
        } catch {
            setError("Could not delete learning item.");
        }
    }
    return <RequireAuth><AppShell active="updates" breadcrumb="Daily Updates & Learning">
        <div className="max-w-6xl px-gutter-lg py-space-lg">
            <h1 className="font-headline-xl text-headline-xl font-bold text-on-surface">
                Daily updates & learning
            </h1>
            <p className="mt-1 text-on-surface-variant">
                Keep the team aligned and turn knowledge-sharing into visible progress.
            </p>
            {error && <p className="mt-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{error}</p>}
            <div className={`mt-6 grid items-stretch gap-6 ${canViewLearning ? "lg:grid-cols-2" : "lg:grid-cols-1"}`}>
                <section id="daily-status" className="h-full min-w-0 rounded-xl bg-surface-container-lowest p-5 shadow-sm">
                    <div className="min-h-14">
                        <h2 className="font-headline-md font-bold text-on-surface">Daily updates</h2>
                        <p className="mt-1 text-sm text-on-surface-variant">
                            {canSubmitUpdates ? "Share your progress and keep the team aligned." : "Recent progress shared by the team."}
                        </p>
                    </div>
                    {canSubmitUpdates && <form onSubmit={submit} className="mt-4 space-y-3">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-outline">
                            Update date
                            <input required type="date" value={updateDate} onChange={(event) => setUpdateDate(event.target.value)} className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm" />
                        </label>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-outline">
                            Daily summary
                            <textarea required value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="What moved forward today?" className="mt-1 min-h-36 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm normal-case font-normal" />
                        </label>
                        <div className="grid gap-3 md:grid-cols-2">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-outline">Accomplishments<textarea value={accomplishments} onChange={(event) => setAccomplishments(event.target.value)} placeholder="What did you complete?" className="mt-1 min-h-24 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm normal-case font-normal" /></label>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-outline">Plans<textarea value={plans} onChange={(event) => setPlans(event.target.value)} placeholder="What will you work on next?" className="mt-1 min-h-24 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm normal-case font-normal" /></label>
                        </div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-outline">Tickets<textarea value={blockers} onChange={(event) => setBlockers(event.target.value)} placeholder="Tickets needing attention or help" className="mt-1 min-h-24 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm normal-case font-normal" /></label>
                        <button disabled={isSubmitting} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50">
                            {isSubmitting ? "Submitting..." : "Submit daily status"}
                        </button>
                    </form>}
                    <div className={`${canSubmitUpdates ? "mt-6" : "mt-4"} space-y-3`}>{updates.slice(0, 5).map((update) =>
                        <button
                            key={update.id}
                            type="button"
                            onClick={() => setSelectedUpdate(update)}
                            className="block w-full border-t border-outline-variant/40 pt-3 text-left hover:bg-surface-container-low/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                            <span className="flex justify-between gap-3 text-xs text-outline">
                                <span>{update.user.full_name || update.user.email}</span>
                                <span className="shrink-0">{update.update_date}</span>
                            </span>
                            <span className="mt-1 block text-sm text-on-surface">{update.summary}</span>
                            <span className="mt-1 block text-xs text-primary">View details</span>
                        </button>
                    )
                    }
                    </div>
                </section>
                {canViewLearning && <section className="h-full min-w-0 rounded-xl bg-surface-container-lowest p-5 shadow-sm">
                    <div className="min-h-14">
                        <h2 className="font-headline-md font-bold text-on-surface">Learning tracker</h2>
                        <p className="mt-1 text-sm text-on-surface-variant">Topics and knowledge-sharing sessions.</p>
                    </div>
                    {canManageLearning && <form onSubmit={addLearning} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="min-w-0 flex-1">


                            <input
                                required
                                value={topic}
                                onChange={(event) => setTopic(event.target.value)}
                                placeholder="Topic or KT session"
                                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm"
                            />
                        </div>

                        <div className="w-full sm:w-40">


                            <input
                                required
                                type="date"
                                value={sessionDate}
                                onChange={(event) => setSessionDate(event.target.value)}
                                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm"
                            />
                        </div>

                        <button
                            type="submit"
                            className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-on-secondary"
                        >
                            Add
                        </button>
                    </form>}
                    <div className="mt-5 space-y-3">{learning.map((item) => <div key={item.id} className="border-t border-outline-variant/40 pt-3">
                        {editingLearningId === item.id ? <form onSubmit={(event) => void saveLearning(event, item.id)} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                            <input required maxLength={200} value={editTopic} onChange={(event) => setEditTopic(event.target.value)} aria-label="KT session topic" className="min-w-0 rounded-lg border border-outline-variant px-3 py-2 text-sm" />
                            <input type="date" value={editSessionDate} onChange={(event) => setEditSessionDate(event.target.value)} aria-label="KT session date" className="rounded-lg border border-outline-variant px-3 py-2 text-sm" />
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setEditingLearningId(null)} className="rounded-lg border border-outline-variant px-3 py-2 text-sm">Cancel</button>
                                <button type="submit" className="rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-on-secondary">Save</button>
                            </div>
                        </form> : <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="font-semibold text-on-surface">{item.topic}</p>
                                <p className="text-xs text-outline">{item.owner.full_name || item.owner.email}</p>
                                <p className="mt-1 text-xs text-on-surface-variant">KT session date: {item.session_date ? new Date(`${item.session_date}T00:00:00`).toLocaleDateString() : "Not scheduled"}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {canManageLearning ? <>
                                    {item.status === "completed" ? <span className="rounded-full bg-secondary-container px-2 py-1 text-xs font-semibold text-on-secondary-container">Completed · History</span> : <select aria-label={`Status for ${item.topic}`} value={item.status} onChange={(event) => updateLearning(item.id, { status: event.target.value as LearningStatus }).then(reload).catch(() => setError("Could not update learning item."))} className="rounded-lg border border-outline-variant px-2 py-1 text-xs">
                                        <option value="planned">Planned</option>
                                        <option value="in_progress">In progress</option>
                                        <option value="completed">Completed</option>
                                    </select>}
                                    <button type="button" onClick={() => startEditingLearning(item)} className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-semibold text-on-surface hover:border-secondary hover:text-secondary">Edit</button>
                                    {item.status !== "completed" && <button type="button" onClick={() => void removeLearning(item)} className="rounded-lg border border-error/40 px-3 py-1.5 text-xs font-semibold text-error hover:border-error">Delete</button>}
                                </> : <span className="text-xs capitalize text-on-surface-variant">{item.status.replace("_", " ")}</span>}
                            </div>
                        </div>}
                    </div>
                    )
                    }
                    </div>
                </section>}
            </div>
            {selectedUpdate && <Dialog
                title={`${selectedUpdate.user.full_name || selectedUpdate.user.email} · ${selectedUpdate.update_date}`}
                description="Daily status update"
                onClose={() => setSelectedUpdate(null)}
            >
                <div className="max-h-[65vh] space-y-4 overflow-y-auto text-sm">
                    <div>
                        <h3 className="font-semibold text-on-surface">Summary</h3>
                        <p className="mt-1 whitespace-pre-wrap text-on-surface-variant">{selectedUpdate.summary}</p>
                    </div>
                    {selectedUpdate.accomplishments && <div>
                        <h3 className="font-semibold text-on-surface">Accomplishments</h3>
                        <p className="mt-1 whitespace-pre-wrap text-on-surface-variant">{selectedUpdate.accomplishments}</p>
                    </div>}
                    {selectedUpdate.plans && <div>
                        <h3 className="font-semibold text-on-surface">Plans</h3>
                        <p className="mt-1 whitespace-pre-wrap text-on-surface-variant">{selectedUpdate.plans}</p>
                    </div>}
                    {selectedUpdate.blockers && <div>
                        <h3 className="font-semibold text-on-surface">Tickets</h3>
                        <p className="mt-1 whitespace-pre-wrap text-on-surface-variant">{selectedUpdate.blockers}</p>
                    </div>}
                </div>
            </Dialog>}
        </div>
    </AppShell>
    </RequireAuth>;
}
