import Link from "next/link";
import { Package } from "lucide-react";
import { api } from "@/services/apiClient";
import { authRequired } from "@/lib/auth";
import { formatMoney, type OrderListResponse } from "@repo/shared";
import { ORDER_STATUS_LABELS, ORDER_STATUS_STYLES } from "@/constants/order-status";
import { formatDate } from "@/lib/dates";
import CursorPagination from "@/components/CursorPagination";

export const dynamic = "force-dynamic";

export default async function OrdersPage({
    searchParams,
}: {
    searchParams: Promise<{ cursor?: string }>;
}) {
    await authRequired("/orders");

    const sp = await searchParams;
    const cursorQs = sp.cursor ? `?cursor=${encodeURIComponent(sp.cursor)}` : "";

    const { items, nextCursor } = await api.get<OrderListResponse>(
        `/orders${cursorQs}`,
    );

    return (
        <div className="mx-auto max-w-5xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-semibold text-white">Your orders</h1>
                    <p className="mt-1 text-sm text-slate-400">
                        {items.length === 0
                            ? "No orders yet"
                            : `Showing ${items.length} order${items.length === 1 ? "" : "s"}`}
                    </p>
                </div>
                <Link
                    href="/account"
                    className="text-sm text-sky-400 hover:text-sky-300"
                >
                    Back to account
                </Link>
            </div>

            {items.length === 0 ? (
                <div className="mt-10 flex flex-col items-center rounded-md border border-slate-700 bg-slate-800 p-10 text-center">
                    <Package className="h-12 w-12 text-slate-500" />
                    <h2 className="mt-4 text-xl font-semibold text-white">No orders yet</h2>
                    <p className="mt-2 text-sm text-slate-400">
                        Once you place an order, it will appear here.
                    </p>
                    <Link
                        href="/"
                        className="mt-6 inline-flex items-center rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400"
                    >
                        Browse products
                    </Link>
                </div>
            ) : (
                <>
                    <div className="mt-8 space-y-4">
                        {items.map((order) => {
                            const itemCount = order.items.reduce(
                                (s, i) => s + i.quantity,
                                0,
                            );
                            return (
                                <Link
                                    key={order.id}
                                    href={`/orders/${order.id}`}
                                    className="block rounded-md border border-slate-700 bg-slate-800 p-5 transition hover:border-slate-600"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span
                                                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${ORDER_STATUS_STYLES[order.status]}`}
                                                >
                                                    {ORDER_STATUS_LABELS[order.status]}
                                                </span>
                                                <span className="text-xs text-slate-400">
                                                    Placed {formatDate(order.createdAt)}
                                                </span>
                                            </div>
                                            <div className="mt-2 text-sm text-slate-300">
                                                {itemCount} {itemCount === 1 ? "item" : "items"}
                                            </div>
                                            <div className="mt-1 truncate font-mono text-xs text-slate-500">
                                                #{order.orderNumber}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-semibold text-white">
                                                {formatMoney(
                                                    BigInt(order.totalMinor),
                                                    order.currency,
                                                )}
                                            </div>
                                            <div className="mt-1 text-xs text-sky-400">
                                                View details →
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>

                    <CursorPagination
                        nextCursor={nextCursor}
                        href={`/orders?cursor=${encodeURIComponent(nextCursor!)}`}
                        className="mt-8"
                    />
                </>
            )}
        </div>
    );
}
