"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getNextStatuses, type OrderStatus } from "@repo/shared";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ORDER_STATUS_LABELS } from "@/lib/order-status";

// REFUND is handled via POST /orders/:id/refund (calls Stripe), not status patch.

const TRANSITION_STYLES: Record<OrderStatus, string> = {
    PENDING: "bg-amber-500 hover:bg-amber-400 text-slate-900",
    PAID: "bg-sky-500 hover:bg-sky-400 text-slate-900",
    PROCESSING: "bg-indigo-500 hover:bg-indigo-400 text-white",
    SHIPPED: "bg-violet-500 hover:bg-violet-400 text-white",
    DELIVERED: "bg-emerald-500 hover:bg-emerald-400 text-slate-900",
    CANCELLED: "bg-red-500 hover:bg-red-400 text-white",
    FAILED: "bg-slate-500 hover:bg-slate-400 text-white",
    REFUNDED: "bg-fuchsia-500 hover:bg-fuchsia-400 text-white",
};

interface Props {
    orderId: string;
    currentStatus: OrderStatus;
}

export default function OrderStatusControls({ orderId, currentStatus }: Props) {
    const router = useRouter();
    const [activeStatus, setActiveStatus] = useState<OrderStatus | null>(null);
    const { execute, loading, error, clearError } = useApiMutation();

    const next = getNextStatuses(currentStatus);

    async function update(status: OrderStatus) {
        setActiveStatus(status);
        const isRefund = status === "REFUNDED";
        const url = isRefund
            ? `/orders/${orderId}/refund`
            : `/orders/${orderId}/status`;
        const method = isRefund ? "POST" : "PATCH";
        const body = isRefund
            ? undefined
            : JSON.stringify({ status });

        const result = await execute(url, {
            method,
            headers: body ? { "Content-Type": "application/json" } : undefined,
            body,
        }, isRefund ? "Failed to initiate refund" : "Failed to update status");

        setActiveStatus(null);
        if (!result.ok) return;
        router.refresh();
    }

    return (
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Update status
            </h2>

            {next.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">
                    This order is in a terminal state ({ORDER_STATUS_LABELS[currentStatus]}).
                    No further updates available.
                </p>
            ) : (
                <div className="mt-4 space-y-2">
                    {next.map((status) => {
                        const isActive = activeStatus === status;
                        const disabled = loading;
                        return (
                            <button
                                key={status}
                                type="button"
                                onClick={() => update(status)}
                                disabled={disabled}
                                className={`inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${TRANSITION_STYLES[status]}`}
                            >
                                {isActive ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Updating...
                                    </>
                                ) : status === "REFUNDED" ? (
                                    "Initiate Refund"
                                ) : (
                                    `Mark as ${ORDER_STATUS_LABELS[status]}`
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {error && (
                <div className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                    {error}
                </div>
            )}
        </div>
    );
}
