import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Check, Circle } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney, type OrderDTO } from "@repo/shared";
import {
    ORDER_CANCELLABLE,
    ORDER_STATUS_LABELS,
    ORDER_STATUS_STYLES,
    ORDER_TIMELINE,
} from "@/lib/order_status";
import CancelOrderButton from "@/components/CancelOrderButton";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

export default async function OrderDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ redirect_status?: string }>;
}) {
    const { id } = await params;
    const { redirect_status: redirectStatus } = await searchParams;
    const justPaid = redirectStatus === "succeeded";
    const user = await getCurrentUser();
    if (!user) redirect(`/signin?next=/orders/${id}`);

    let order: OrderDTO;
    try {
        ({ order } = await api.get<{ order: OrderDTO }>(
            `/orders/${encodeURIComponent(id)}`,
        ));
    } catch (err) {
        if (err instanceof ApiClientError && err.status === 404) notFound();
        throw err;
    }

    const isCancelled = order.status === "CANCELLED";
    const isFailed = order.status === "FAILED";
    const showTimeline = !isCancelled && !isFailed;
    const currentTimelineIdx = ORDER_TIMELINE.indexOf(order.status);
    const canCancel = ORDER_CANCELLABLE.includes(order.status);

    return (
        <div className="mx-auto max-w-5xl">
            <div className="text-sm text-slate-400">
                <Link href="/orders" className="hover:text-sky-400">
                    Your orders
                </Link>
                <span className="mx-2 text-slate-600">/</span>
                <span className="text-slate-300">Order details</span>
            </div>

            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-semibold text-white">Order details</h1>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400">
                        <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${ORDER_STATUS_STYLES[order.status]}`}
                        >
                            {ORDER_STATUS_LABELS[order.status]}
                        </span>
                        <span>Placed {formatDateTime(order.createdAt)}</span>
                        {order.paidAt && <span>· Paid {formatDateTime(order.paidAt)}</span>}
                    </div>
                    <div className="mt-1 font-mono text-xs text-slate-500">#{order.id}</div>
                </div>
                {canCancel && <CancelOrderButton orderId={order.id} />}
            </div>

            {order.status === "PENDING" && justPaid && (
                <section className="mt-6 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                    Payment received — confirming with your bank. This page will
                    update automatically; refresh if it doesn&apos;t.
                </section>
            )}
            {order.status === "PENDING" && !justPaid && (
                <section className="mt-6 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                    Payment hasn&apos;t been confirmed yet.{" "}
                    <Link
                        href={`/orders/${encodeURIComponent(order.id)}/pay`}
                        className="font-medium underline hover:text-amber-50"
                    >
                        Complete payment
                    </Link>{" "}
                    or cancel this order.
                </section>
            )}

            {showTimeline && (
                <section className="mt-8 rounded-md border border-slate-700 bg-slate-800 p-6">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                        Progress
                    </h2>

                    <ol className="relative mt-5 grid grid-cols-5 gap-6">
                        {/* connector line */}
                        <div className="absolute top-3 left-0 right-0 h-[1px] bg-slate-700" />

                        {ORDER_TIMELINE.map((status, idx) => {
                            const reached = idx <= currentTimelineIdx;
                            const isCurrent = idx === currentTimelineIdx;

                            return (
                                <li key={status} className="flex flex-col items-center text-center relative z-10">
                                    <div
                                        className={`flex h-7 w-7 items-center justify-center rounded-full border ${reached
                                                ? "border-sky-500 bg-sky-500/20 text-sky-300"
                                                : "border-slate-600 bg-slate-900 text-slate-600"
                                            }`}
                                    >
                                        {reached ? (
                                            <Check className="h-4 w-4" />
                                        ) : (
                                            <Circle className="h-3 w-3" />
                                        )}
                                    </div>

                                    <div
                                        className={`mt-2 text-xs font-medium ${isCurrent
                                                ? "text-sky-300"
                                                : reached
                                                    ? "text-slate-200"
                                                    : "text-slate-500"
                                            }`}
                                    >
                                        {ORDER_STATUS_LABELS[status]}
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                </section>
            )}

            {isCancelled && (
                <section className="mt-8 rounded-md border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200">
                    This order was cancelled. Stock has been restored.
                </section>
            )}

            {isFailed && (
                <section className="mt-8 rounded-md border border-slate-500/40 bg-slate-500/10 p-6 text-sm text-slate-300">
                    Payment failed. Stock has been restored — feel free to try again from
                    your cart.
                </section>
            )}

            <div className="mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]">
                <section>
                    <h2 className="text-lg font-semibold text-white">Items</h2>
                    <div className="mt-4 divide-y divide-slate-700 rounded-md border border-slate-700 bg-slate-800">
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

                <aside>
                    <div className="mb-6 rounded-md border border-slate-700 bg-slate-800 p-6">
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

                    <div className="rounded-md border border-slate-700 bg-slate-800 p-6">
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
                            <div className="my-3 h-px bg-slate-700" />
                            <div className="flex justify-between text-base font-semibold text-white">
                                <dt>Total</dt>
                                <dd>
                                    {formatMoney(
                                        BigInt(order.totalMinor),
                                        order.currency,
                                    )}
                                </dd>
                            </div>
                        </dl>
                    </div>
                </aside>
            </div>
        </div>
    );
}
