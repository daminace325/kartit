"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApiMutation } from "@/hooks/useApiMutation";
import { PASSWORD_MIN_LENGTH, PASSWORD_RULES_TEXT } from "@/lib/auth";
import { ErrorBanner } from "@/components/ErrorBanner";

export default function ChangePasswordForm() {
    const router = useRouter();
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const { execute, loading, error, setError } = useApiMutation();
    const [saved, setSaved] = useState(false);

    async function handleSubmit(e: React.SyntheticEvent) {
        e.preventDefault();
        setSaved(false);

        if (newPassword.length < PASSWORD_MIN_LENGTH) {
            setError(`New password must be at least ${PASSWORD_MIN_LENGTH} characters`);
            return;
        }
        if (newPassword !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        if (newPassword === currentPassword) {
            setError("New password must be different from current password");
            return;
        }

        const result = await execute(
            "/auth/change-password",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword }),
            },
            "Failed to change password",
        );
        if (!result.ok) return;

        setSaved(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        router.refresh();
        setTimeout(() => setSaved(false), 2500);
    }

    return (
        <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
            <ErrorBanner message={error} />
            {saved && (
                <div role="status" className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                    Password changed successfully
                </div>
            )}

            <div>
                <label className="mb-1 block text-sm font-medium text-slate-200">
                    Current password
                </label>
                <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
            </div>

            <div>
                <label className="mb-1 block text-sm font-medium text-slate-200">
                    New password
                </label>
                <input
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={PASSWORD_MIN_LENGTH}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
                <p className="mt-1 text-xs text-slate-500">{PASSWORD_RULES_TEXT}</p>
            </div>

            <div>
                <label className="mb-1 block text-sm font-medium text-slate-200">
                    Confirm new password
                </label>
                <input
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
            </div>

            <button
                type="submit"
                disabled={loading}
                className="rounded bg-sky-500 px-4 py-2 font-medium text-white hover:bg-sky-400 disabled:opacity-60"
            >
                {loading ? "Updating..." : "Change password"}
            </button>
        </form>
    );
}
