"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatApiError } from "@/lib/errors";
import { csrfFetch } from "@/lib/csrf";

export default function ClearCartButton() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    async function handleClick() {
        if (!confirm("Clear all items from your cart?")) return;
        setLoading(true);
        try {
            const res = await csrfFetch("/api/cart", { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                alert(formatApiError(data?.error, "Failed to clear cart"));
                return;
            }
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
            className="text-sm text-slate-400 hover:text-red-300 disabled:opacity-50"
        >
            {loading ? "Clearing..." : "Clear cart"}
        </button>
    );
}
