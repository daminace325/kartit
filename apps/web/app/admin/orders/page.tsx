import Link from "next/link";
import { api } from "@/lib/apiClient";
import { formatMoney, type OrderListResponse } from "@repo/shared";
import { ORDER_STATUS_LABELS, ORDER_STATUS_STYLES } from "@/lib/order-status";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({
    searchParams,
}: {
    searchParams: Promise<{ cursor?: string }>;
}) {
    const sp = await searchParams;
    const params = new URLSearchParams({ scope: "all" });
    if (sp.cursor) params.set("cursor", sp.cursor);

    const { items, nextCursor } = await api.get<OrderListResponse>(
        `/orders?${params.toString()}`,
    );

    return (
        <div className="px-8 py-8">
            <div className="mb-6">
                <h1 className="text-3xl font-semibold text-white">Orders</h1>
                <p className="mt-1 text-sm text-slate-400">
                    {items.length} {items.length === 1 ? "order" : "orders"} on this page
                </p>
            </div>

            {items.length === 0 ? (
                <div className="rounded-lg border border-slate-800 bg-slate-900 p-10 text-center text-sm text-slate-400">
                    No orders found.
                </div>
            ) : (
                <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-800 bg-slate-900/60 text-left text-xs uppercase tracking-wide text-slate-400">
                                <th className="px-4 py-3">Order</th>
                                <th className="px-4 py-3">Customer</th>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Items</th>
                                <th className="px-4 py-3 text-right">Total</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {items.map((order) => {
                                const itemCount = order.items.reduce(
                                    (s, i) => s + i.quantity,
                                    0,
                                );
                                return (
                                    <tr key={order.id} className="hover:bg-slate-800/40">
                                        <td className="px-4 py-3">
                                            <div className="font-mono text-xs text-slate-300">
                                                #{order.id.slice(0, 10)}…
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-[10px] text-slate-500">
                                            {order.userId}
                                        </td>
                                        <td className="px-4 py-3 text-slate-400">
                                            {formatDate(order.createdAt)}
                                        </td>
                                        <td className="px-4 py-3 text-slate-300">{itemCount}</td>
                                        <td className="px-4 py-3 text-right font-medium text-white">
                                            {formatMoney(
                                                BigInt(order.totalMinor),
                                                order.currency,
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${ORDER_STATUS_STYLES[order.status]}`}
                                            >
                                                {ORDER_STATUS_LABELS[order.status]}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Link
                                                href={`/admin/orders/${order.id}`}
                                                className="text-xs font-medium text-sky-400 hover:text-sky-300"
                                            >
                                                Manage →
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {nextCursor && (
                <div className="mt-6 flex justify-center">
                    <Link
                        href={`/admin/orders?cursor=${encodeURIComponent(nextCursor)}`}
                        className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
                    >
                        Load more →
                    </Link>
                </div>
            )}
        </div>
    );
}
