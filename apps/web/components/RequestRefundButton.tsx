"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ErrorBanner } from "@/components/ErrorBanner";

export default function RequestRefundButton({ orderId }: { orderId: string }) {
    const router = useRouter();
    const [confirming, setConfirming] = useState(false);
    const [reason, setReason] = useState("");
    const { execute, loading, error, clearError } = useApiMutation();

    async function request() {
        const body = reason.trim() ? JSON.stringify({ reason: reason.trim() }) : undefined;
        const result = await execute(
            `/orders/${orderId}/request-refund`,
            {
                method: "POST",
                headers: body ? { "Content-Type": "application/json" } : undefined,
                body,
            },
            "Failed to request refund",
        );
        if (!result.ok) return;
        setConfirming(false);
        router.refresh();
    }

    if (!confirming) {
        return (
            <button
                type="button"
                onClick={() => setConfirming(true)}
                className="inline-flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-300 hover:bg-amber-500/20"
            >
                <RotateCcw className="h-4 w-4" />
                Request refund
            </button>
        );
    }

    return (
        <div className="flex flex-col items-end gap-3">
            <div className="w-full max-w-sm">
                <label className="text-xs text-slate-400">
                    Reason (optional)
                </label>
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={loading}
                    rows={2}
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 disabled:opacity-50"
                    placeholder="Why are you requesting a refund?"
                />
            </div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => {
                        setConfirming(false);
                        setReason("");
                        clearError();
                    }}
                    disabled={loading}
                    className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:border-slate-500 disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={request}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {loading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Submitting...
                        </>
                    ) : (
                        "Confirm request"
                    )}
                </button>
            </div>
            <ErrorBanner message={error} className="rounded-md text-xs text-red-200" />
        </div>
    );
}
