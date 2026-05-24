"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, X } from "lucide-react";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ErrorBanner } from "@/components/ErrorBanner";

interface Props {
    requestId: string;
    size?: "sm" | "md";
}

export default function RefundRequestActions({ requestId, size = "md" }: Props) {
    const router = useRouter();
    const [action, setAction] = useState<"approve" | "reject" | null>(null);
    const { execute, loading, error, clearError } = useApiMutation();

    async function doAction(type: "approve" | "reject") {
        setAction(type);
        const result = await execute(
            `/orders/refund-requests/${requestId}/${type}`,
            { method: "POST" },
            `Failed to ${type} refund request`,
        );
        setAction(null);
        if (!result.ok) return;
        router.refresh();
    }

    const btnClass =
        size === "sm"
            ? "px-2 py-1 text-xs"
            : "px-3 py-1.5 text-sm";

    if (error) {
        return <ErrorBanner message={error} className="rounded-md text-xs text-red-200" />;
    }

    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={() => doAction("approve")}
                disabled={loading}
                className={`inline-flex items-center gap-1.5 rounded-md bg-emerald-500 font-medium text-white hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 ${btnClass}`}
            >
                {action === "approve" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                    <Check className="h-3.5 w-3.5" />
                )}
                Approve
            </button>
            <button
                type="button"
                onClick={() => doAction("reject")}
                disabled={loading}
                className={`inline-flex items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/10 font-medium text-red-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60 ${btnClass}`}
            >
                {action === "reject" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                    <X className="h-3.5 w-3.5" />
                )}
                Reject
            </button>
        </div>
    );
}
