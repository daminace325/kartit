"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { formatApiError } from "@/lib/errors";

export default function DeleteCategoryButton({
    id,
    name,
}: {
    id: string;
    name: string;
}) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    async function handleClick() {
        if (!confirm(`Delete category "${name}"? This cannot be undone.`)) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                alert(formatApiError(data?.error, "Failed to delete"));
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
            className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50"
        >
            <Trash2 className="h-4 w-4" />
            {loading ? "Deleting..." : "Delete"}
        </button>
    );
}
