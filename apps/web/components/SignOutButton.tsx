"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/apiClient";

export default function SignOutButton({ className }: { className?: string }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    async function handleClick() {
        setLoading(true);
        try {
            await api.post("/auth/signout");
            router.push("/");
            router.refresh();
        } finally {
            setLoading(false);
        }
    }

    return (
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
    );
}
