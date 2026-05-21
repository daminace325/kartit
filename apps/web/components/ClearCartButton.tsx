"use client";

import { useRouter } from "next/navigation";
import { useApiMutation } from "@/hooks/useApiMutation";

export default function ClearCartButton() {
    const router = useRouter();
    const { execute, loading } = useApiMutation();

    async function handleClick() {
        if (!confirm("Clear all items from your cart?")) return;
        const result = await execute("/api/cart", { method: "DELETE" }, "Failed to clear cart");
        if (!result.ok) {
            alert(result.error);
            return;
        }
        router.refresh();
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
