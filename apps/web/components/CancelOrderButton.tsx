"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { formatApiError } from "@/lib/formatApiError";
import { csrfFetch } from "@/lib/csrf";
import { ErrorBanner } from "@/components/ErrorBanner";

export default function CancelOrderButton({ orderId }: { orderId: string }) {
    const router = useRouter();
    const [confirming, setConfirming] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function cancel() {
        setLoading(true);
        setError(null);
        try {
            const res = await csrfFetch(`/api/orders/${orderId}/cancel`, {
                method: "POST",
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(formatApiError(data?.error, "Failed to cancel order"));
                setLoading(false);
                return;
            }
            setConfirming(false);
            setLoading(false);
            router.refresh();
        } catch {
            setError("Network error. Please try again.");
            setLoading(false);
        }
    }

    if (!confirming) {
        return (
            <button
                type="button"
                onClick={() => setConfirming(true)}
                className="inline-flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/20"
            >
                <X className="h-4 w-4" />
                Cancel order
            </button>
        );
    }

    return (
        <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => {
                        setConfirming(false);
                        setError(null);
                    }}
                    disabled={loading}
                    className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:border-slate-500 disabled:opacity-50"
                >
                    Keep order
                </button>
                <button
                    type="button"
                    onClick={cancel}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {loading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Cancelling...
                        </>
                    ) : (
                        "Confirm cancel"
                    )}
                </button>
            </div>
            <ErrorBanner message={error} className="rounded-md text-xs text-red-200" />
        </div>
    );
}
