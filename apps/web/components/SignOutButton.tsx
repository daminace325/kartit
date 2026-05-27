"use client";

import { useRouter } from "next/navigation";
import { useApiMutation } from "@/hooks/useApiMutation";

export default function SignOutButton({ className }: { className?: string }) {
    const router = useRouter();
    const { execute, loading, error } = useApiMutation();

    async function handleClick() {
        const result = await execute("/auth/signout", { method: "POST" });
        if (result.ok) {
            router.push("/");
            router.refresh();
        }
    }

    return (
        <div>
            <button
                type="button"
                onClick={handleClick}
                disabled={loading}
                className={
                    className ??
                    "rounded border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 disabled:opacity-60"
                }
            >
                {loading ? "Signing out..." : "Sign out"}
            </button>
            {error && (
                <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>
            )}
        </div>
    );
}
