"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";
import { createLearning, listDailyUpdates, listLearning, submitDailyUpdate, updateLearning } from "@/lib/work-api";
import type { DailyUpdate, LearningItem, LearningStatus } from "@/types/work";

export default function UpdatesPage() {
    const today = new Date().toISOString().slice(0, 10);
    const [updates, setUpdates] = useState<DailyUpdate[]>([]);
    const [learning, setLearning] = useState<LearningItem[]>([]);
    const [summary, setSummary] = useState("");
    const [updateDate, setUpdateDate] = useState(today);
    const [topic, setTopic] = useState("");
    const [sessionDate, setSessionDate] = useState(today);
    const [error, setError] = useState<string | null>(null);
    const reload = () => Promise.all([listDailyUpdates(), listLearning()])
        .then(([updatePage, learningPage]) => {
            setUpdates(updatePage.items); setLearning(learningPage.items);
        }).catch(
            () => setError("Could not load updates."));
    useEffect(() => { void reload(); }, []);
    async function submit(event: React.FormEvent) {
        event.preventDefault();
        try {
            await submitDailyUpdate({ update_date: updateDate, summary });
            setSummary("");
            await reload();
        } catch {
            setError("Could not submit update.");
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
    return <RequireAuth><AppShell active="updates" breadcrumb="Daily Updates & Learning">
        <div className="max-w-6xl px-gutter-lg py-space-lg">
            <h1 className="font-headline-xl text-headline-xl font-bold text-on-surface">
                Daily updates & learning
            </h1>
            <p className="mt-1 text-on-surface-variant">
                Keep the team aligned and turn knowledge-sharing into visible progress.
            </p>
            {error && <p className="mt-4 rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container">{error}</p>}
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <section className="rounded-xl bg-surface-container-lowest p-5 shadow-sm">
                    <h2 className="font-headline-md font-bold text-on-surface">Submit daily update</h2>
                    <form onSubmit={submit} className="mt-4 space-y-3">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-outline">
                            Update date
                            <input required type="date" value={updateDate} onChange={(event) => setUpdateDate(event.target.value)} className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm" />
                        </label>
                        <textarea required value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="What moved forward today?" className="min-h-28 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm" />
                        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
                            Submit update
                        </button>
                    </form>
                    <div className="mt-6 space-y-3">{updates.slice(0, 5).map((update) =>
                        <div key={update.id} className="border-t border-outline-variant/40 pt-3">
                            <div className="flex justify-between text-xs text-outline">
                                <span>{update.user.full_name || update.user.email}</span>
                                <span>{update.update_date}</span>
                            </div>
                            <p className="mt-1 text-sm text-on-surface">{update.summary}</p>
                        </div>
                    )
                    }
                    </div>
                </section>
                <section className="rounded-xl bg-surface-container-lowest p-5 shadow-sm">
                    <h2 className="font-headline-md font-bold text-on-surface">Learning tracker</h2>
                    <form onSubmit={addLearning} className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
                    </form>
                    <div className="mt-5 space-y-3">{learning.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 border-t border-outline-variant/40 pt-3">
                        <div>
                            <p className="font-semibold text-on-surface">{item.topic}</p>
                            <p className="text-xs text-outline">{item.owner.full_name || item.owner.email}{item.session_date ? ` · ${item.session_date}` : ""}</p>
                        </div>
                        <select value={item.status} onChange={(event) => updateLearning(item.id, event.target.value as LearningStatus).then(reload)} className="rounded-lg border border-outline-variant px-2 py-1 text-xs">
                            <option value="planned">Planned</option>
                            <option value="in_progress">In progress</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>
                    )
                    }
                    </div>
                </section>
            </div>
        </div>
    </AppShell>
    </RequireAuth>;
}
