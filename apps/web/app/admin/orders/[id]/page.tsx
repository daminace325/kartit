import Link from "next/link";
import { notFound } from "next/navigation";
import { api, ApiClientError } from "@/lib/api";
import { formatMoney, type OrderDTO } from "@repo/shared";
import { ORDER_STATUS_LABELS, ORDER_STATUS_STYLES } from "@/lib/order_status";
import OrderStatusControls from "@/components/OrderStatusControls";
import { formatDateTime } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    let order: OrderDTO;
    try {
        ({ order } = await api.get<{ order: OrderDTO }>(
            `/orders/${encodeURIComponent(id)}`,
        ));
    } catch (err) {
        if (err instanceof ApiClientError && err.status === 404) notFound();
        throw err;
    }

    return (
        <div className="px-8 py-8">
            <div className="text-sm text-slate-400">
                <Link href="/admin/orders" className="hover:text-sky-400">
                    Orders
                </Link>
                <span className="mx-2 text-slate-600">/</span>
                <span className="text-slate-300">Order details</span>
            </div>

            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-white">Order details</h1>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400">
                        <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${ORDER_STATUS_STYLES[order.status]}`}
                        >
                            {ORDER_STATUS_LABELS[order.status]}
                        </span>
                        <span>Placed {formatDateTime(order.createdAt)}</span>
                        <span>· Updated {formatDateTime(order.updatedAt)}</span>
                    </div>
                    <div className="mt-1 font-mono text-xs text-slate-500">#{order.id}</div>
                </div>
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]">
                <div className="space-y-8">
                    <section>
                        <h2 className="text-lg font-semibold text-white">Items</h2>
                        <div className="mt-4 divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-900">
                            {order.items.map((item) => (
                                <div key={item.id} className="flex gap-4 p-4">
                                    <div className="flex flex-1 items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-medium text-white">
                                                {item.productName}
                                            </div>
                                            <div className="text-xs text-slate-400">
                                                Qty {item.quantity} ·{" "}
                                                {formatMoney(
                                                    BigInt(item.unitPriceMinor),
                                                    item.currency,
                                                )}{" "}
                                                each
                                            </div>
                                            <div className="mt-0.5 font-mono text-[10px] text-slate-600">
                                                {item.productId}
                                            </div>
                                        </div>
                                        <div className="text-sm font-medium text-white">
                                            {formatMoney(
                                                BigInt(item.totalMinor),
                                                item.currency,
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                <aside className="space-y-6">
                    <OrderStatusControls
                        orderId={order.id}
                        currentStatus={order.status}
                    />

                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                            Customer
                        </h2>
                        <div className="mt-3 text-sm">
                            <div className="font-mono text-[10px] text-slate-600">
                                {order.userId}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                            Shipping address
                        </h2>
                        <div className="mt-4 text-sm text-slate-300">
                            <p className="font-medium text-white">{order.shippingName}</p>
                            <p className="text-slate-400">{order.shippingPhone}</p>
                            <p className="mt-3">{order.shippingLine1}</p>
                            {order.shippingLine2 && <p>{order.shippingLine2}</p>}
                            <p>
                                {order.shippingCity}
                                {order.shippingState ? `, ${order.shippingState}` : ""}{" "}
                                {order.shippingPostalCode}
                            </p>
                            <p>{order.shippingCountry}</p>
                        </div>
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                            Summary
                        </h2>
                        <dl className="mt-4 space-y-2 text-sm">
                            <div className="flex justify-between text-slate-300">
                                <dt>Subtotal</dt>
                                <dd>
                                    {formatMoney(
                                        BigInt(order.subtotalMinor),
                                        order.currency,
                                    )}
                                </dd>
                            </div>
                            <div className="flex justify-between text-slate-300">
                                <dt>Shipping</dt>
                                <dd>
                                    {BigInt(order.shippingMinor) === 0n
                                        ? "Free"
                                        : formatMoney(
                                              BigInt(order.shippingMinor),
                                              order.currency,
                                          )}
                                </dd>
                            </div>
                            <div className="flex justify-between text-slate-300">
                                <dt>Tax</dt>
                                <dd>
                                    {BigInt(order.taxMinor) === 0n
                                        ? "—"
                                        : formatMoney(
                                              BigInt(order.taxMinor),
                                              order.currency,
                                          )}
                                </dd>
                            </div>
                            <div className="my-3 h-px bg-slate-800" />
                            <div className="flex justify-between text-base font-semibold text-white">
                                <dt>Total</dt>
                                <dd>
                                    {formatMoney(
                                        BigInt(order.totalMinor),
                                        order.currency,
                                    )}
                                </dd>
                            </div>
                            {order.paidAt && (
                                <div className="pt-2 text-xs text-slate-500">
                                    Paid at {formatDateTime(order.paidAt)}
                                </div>
                            )}
                        </dl>
                    </div>
                </aside>
            </div>
        </div>
    );
}
