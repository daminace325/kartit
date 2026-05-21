"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useApiMutation } from "@/hooks/useApiMutation";

export default function DeleteProductButton({
    id,
    name,
}: {
    id: string;
    name: string;
}) {
    const router = useRouter();
    const { execute, loading } = useApiMutation();

    async function handleClick() {
        if (!confirm(`Delete product "${name}"? This cannot be undone.`)) return;
        const result = await execute(
            `/products/${id}`,
            { method: "DELETE" },
            "Failed to delete",
        );
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
            className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50"
        >
            <Trash2 className="h-4 w-4" />
            {loading ? "Deleting..." : "Delete"}
        </button>
    );
}
