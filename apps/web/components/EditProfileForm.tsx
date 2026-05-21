"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ErrorBanner } from "@/components/ErrorBanner";

export default function EditProfileForm({
    initialName,
    email,
}: {
    initialName: string;
    email: string;
}) {
    const router = useRouter();
    const [name, setName] = useState(initialName);
    const { execute, loading, error, clearError } = useApiMutation();
    const [saved, setSaved] = useState(false);

    async function handleSubmit(e: React.SyntheticEvent) {
        e.preventDefault();
        setSaved(false);
        const result = await execute(
            "/auth/me",
            {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim() }),
            },
            "Failed to save",
        );
        if (!result.ok) return;
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 2000);
    }

    const dirty = name.trim() !== initialName.trim();

    return (
        <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
            <ErrorBanner message={error} />
            {saved && (
                <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                    Profile updated
                </div>
            )}

            <div>
                <label className="mb-1 block text-sm font-medium text-slate-200">
                    Name
                </label>
                <input
                    type="text"
                    required
                    minLength={1}
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
            </div>

            <div>
                <label className="mb-1 block text-sm font-medium text-slate-200">
                    Email
                </label>
                <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full cursor-not-allowed rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-slate-400 outline-none"
                />
                <p className="mt-1 text-xs text-slate-500">
                    Email cannot be changed.
                </p>
            </div>

            <button
                type="submit"
                disabled={loading || !dirty}
                className="rounded bg-sky-500 px-4 py-2 font-medium text-white hover:bg-sky-400 disabled:opacity-60"
            >
                {loading ? "Saving..." : "Save changes"}
            </button>
        </form>
    );
}
