/**
 * Shared status styles + labels for ecomm OrderStatus
 * (PENDING | PAID | PROCESSING | SHIPPED | DELIVERED | CANCELLED | FAILED | REFUNDED).
 */
import type { OrderStatus } from "@repo/shared";

export const ORDER_STATUS_STYLES: Record<OrderStatus, string> = {
    PENDING: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    PAID: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    PROCESSING: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    SHIPPED: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    DELIVERED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    CANCELLED: "bg-red-500/15 text-red-300 border-red-500/30",
    FAILED: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    REFUNDED: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
    PENDING: "Pending payment",
    PAID: "Paid",
    PROCESSING: "Processing",
    SHIPPED: "Shipped",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
    FAILED: "Failed",
    REFUNDED: "Refunded",
};

export const ORDER_TIMELINE: OrderStatus[] = [
    "PENDING",
    "PAID",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
];
export const ORDER_CANCELLABLE: readonly OrderStatus[] = ["PENDING", "PAID", "PROCESSING"];
