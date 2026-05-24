import Link from "next/link";
import { api } from "@/services/apiClient";
import RefundRequestActions from "@/components/RefundRequestActions";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

type RefundRequestItem = {
    id: string;
    orderId: string;
    userId: string;
    status: string;
    reason: string | null;
    reviewedBy: string | null;
    reviewedAt: string | null;
    createdAt: string;
    order: {
        totalMinor: string;
        currency: string;
        shippingName: string;
    };
};

type ListResponse = {
    items: RefundRequestItem[];
    nextCursor: string | null;
};

const STATUS_STYLES: Record<string, string> = {
    PENDING: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    APPROVED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    REJECTED: "bg-red-500/15 text-red-300 border-red-500/30",
};

const STATUS_LABELS: Record<string, string> = {
    PENDING: "Pending",
    APPROVED: "Approved",
    REJECTED: "Rejected",
};

function formatMoney(minor: string, currency: string): string {
    const amount = BigInt(minor);
    const major = Number(amount) / 100;
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency.toUpperCase(),
    }).format(major);
}

export default async function AdminRefundRequestsPage({
    searchParams,
}: {
    searchParams: Promise<{ tab?: string; cursor?: string }>;
}) {
    const sp = await searchParams;
    const tab = sp.tab ?? "pending";

    const params = new URLSearchParams();
    if (tab === "pending") params.set("status", "PENDING");
    if (sp.cursor) params.set("cursor", sp.cursor);

    const { items, nextCursor } = await api.get<ListResponse>(
        `/orders/refund-requests?${params.toString()}`,
    );

    return (
        <div className="px-8 py-8">
            <div className="mb-6">
                <h1 className="text-3xl font-semibold text-white">
                    Refund requests
                </h1>
            </div>

            <div className="mb-6 flex gap-2">
                <Link
                    href="/admin/refund-requests?tab=pending"
                    className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                        tab === "pending"
                            ? "bg-amber-500/20 text-amber-300"
                            : "text-slate-400 hover:text-slate-200"
                    }`}
                >
                    Pending
                </Link>
                <Link
                    href="/admin/refund-requests?tab=all"
                    className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                        tab === "all"
                            ? "bg-sky-500/20 text-sky-300"
                            : "text-slate-400 hover:text-slate-200"
                    }`}
                >
                    All
                </Link>
            </div>

            {items.length === 0 ? (
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-10 text-center text-sm text-slate-400">
                    {tab === "pending"
                        ? "No pending refund requests."
                        : "No refund requests found."}
                </div>
            ) : (
                <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-800 bg-slate-900/60 text-left text-xs uppercase tracking-wide text-slate-400">
                                <th className="px-4 py-3">Order</th>
                                <th className="px-4 py-3">Customer</th>
                                <th className="px-4 py-3">Total</th>
                                <th className="px-4 py-3">Reason</th>
                                <th className="px-4 py-3">Requested</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {items.map((req) => (
                                <tr
                                    key={req.id}
                                    className="hover:bg-slate-800/40"
                                >
                                    <td className="px-4 py-3">
                                        <Link
                                            href={`/admin/orders/${req.orderId}`}
                                            className="font-mono text-xs text-sky-400 hover:text-sky-300"
                                        >
                                            #{req.orderId.slice(0, 10)}…
                                        </Link>
                                    </td>
                                    <td className="px-4 py-3 text-slate-400">
                                        {req.order.shippingName}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-white">
                                        {formatMoney(
                                            req.order.totalMinor,
                                            req.order.currency,
                                        )}
                                    </td>
                                    <td className="max-w-xs px-4 py-3 text-slate-400">
                                        {req.reason ? (
                                            <span className="line-clamp-2">
                                                {req.reason}
                                            </span>
                                        ) : (
                                            <span className="text-slate-600">
                                                —
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-slate-400">
                                        {formatDate(req.createdAt)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[req.status]}`}
                                        >
                                            {STATUS_LABELS[req.status]}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {req.status === "PENDING" && (
                                            <RefundRequestActions
                                                requestId={req.id}
                                                size="sm"
                                            />
                                        )}
                                        {req.status === "APPROVED" &&
                                            req.reviewedAt && (
                                                <span className="text-xs text-emerald-400">
                                                    {req.reviewedBy
                                                        ? `by ${req.reviewedBy.slice(0, 8)}… `
                                                        : ""}
                                                    {formatDate(req.reviewedAt)}
                                                </span>
                                            )}
                                        {req.status === "REJECTED" &&
                                            req.reviewedAt && (
                                                <span className="text-xs text-red-400">
                                                    {req.reviewedBy
                                                        ? `by ${req.reviewedBy.slice(0, 8)}… `
                                                        : ""}
                                                    {formatDate(req.reviewedAt)}
                                                </span>
                                            )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {nextCursor && (
                <div className="mt-6 flex justify-center">
                    <Link
                        href={`/admin/refund-requests?tab=${tab}&cursor=${encodeURIComponent(nextCursor)}`}
                        className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
                    >
                        Load more →
                    </Link>
                </div>
            )}
        </div>
    );
}
