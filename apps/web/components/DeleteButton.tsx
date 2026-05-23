"use client";

import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { useApiMutation } from "@/hooks/useApiMutation";

type Props = {
    entityType: "category" | "product";
    id: string;
    name: string;
};

export default function DeleteButton({ entityType, id, name }: Props) {
    const router = useRouter();
    const { execute, loading, error, setError, clearError } = useApiMutation();

    async function handleClick() {
        if (!confirm(`Delete ${entityType} "${name}"? This cannot be undone.`)) return;
        const result = await execute(
            `/${entityType === "category" ? "categories" : "products"}/${id}`,
            { method: "DELETE" },
            "Failed to delete",
        );
        if (!result.ok) return;
        router.refresh();
    }

    return (
        <div className="inline-flex flex-col items-start gap-1">
            {error && (
                <div className="flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm text-red-300">
                    <span>{error}</span>
                    <button
                        type="button"
                        onClick={clearError}
                        className="ml-1 text-red-400 hover:text-red-200"
                        aria-label="Dismiss error"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}
            <button
                type="button"
                onClick={handleClick}
                disabled={loading}
                className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50"
            >
                <Trash2 className="h-4 w-4" />
                {loading ? "Deleting..." : "Delete"}
            </button>
        </div>
    );
}
