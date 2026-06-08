import Link from "next/link";
import { notFound } from "next/navigation";
import { api, ApiClientError } from "@/services/apiClient";
import { type OrderDTO } from "@repo/shared";
import { ORDER_STATUS_LABELS, ORDER_STATUS_STYLES } from "@/constants/order-status";
import OrderStatusControls from "@/components/OrderStatusControls";
import OrderSummaryBreakdown from "@/components/OrderSummaryBreakdown";
import OrderItemRow from "@/components/OrderItemRow";
import RefundRequestActions from "@/components/RefundRequestActions";
import { formatDateTime } from "@/lib/dates";

export const dynamic = "force-dynamic";

type RefundRequestDTO = {
    id: string;
    orderId: string;
    status: string;
    reason: string | null;
    reviewedBy: string | null;
    reviewedAt: string | null;
    createdAt: string;
};

function RefundRequestSection({ refundRequest }: { refundRequest: RefundRequestDTO }) {
    return (
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Refund request
            </h2>

            <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                    <span className="text-slate-400">Status</span>
                    <span
                        className={
                            refundRequest.status === "PENDING"
                                ? "text-amber-300"
                                : refundRequest.status === "APPROVED"
                                  ? "text-emerald-300"
                                  : "text-red-300"
                        }
                    >
                        {refundRequest.status}
                    </span>
                </div>

                {refundRequest.reason && (
                    <div>
                        <span className="text-slate-400">Reason</span>
                        <p className="mt-1 text-slate-300">{refundRequest.reason}</p>
                    </div>
                )}

                <div className="flex justify-between text-xs text-slate-500">
                    <span>Requested</span>
                    <span>{formatDateTime(refundRequest.createdAt)}</span>
                </div>

                {refundRequest.reviewedAt && (
                    <div className="flex justify-between text-xs text-slate-500">
                        <span>Reviewed</span>
                        <span>{formatDateTime(refundRequest.reviewedAt)}</span>
                    </div>
                )}
            </div>

            {refundRequest.status === "PENDING" && (
                <div className="mt-4">
                    <RefundRequestActions requestId={refundRequest.id} />
                </div>
            )}
        </div>
    );
}

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

    // Fetch refund request for this order
    let refundRequest: RefundRequestDTO | null = null;
    try {
        const res = await api.get<{ refundRequest: RefundRequestDTO | null }>(
            `/orders/${encodeURIComponent(id)}/refund-request`,
        );
        refundRequest = res.refundRequest;
    } catch {
        // Silently ignore — refund request info is supplementary
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
                    <div className="mt-1 font-mono text-xs text-slate-500">#{order.orderNumber}</div>
                </div>
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]">
                <div className="space-y-8">
                    <section>
                        <h2 className="text-lg font-semibold text-white">Items</h2>
                        <div className="mt-4 divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-900">
                            {order.items.map((item) => (
                                <OrderItemRow
                                    key={item.id}
                                    productName={item.productName}
                                    productSlug={item.productSlug}
                                    productId={item.productId}
                                    imageUrl={item.imageUrl}
                                    quantity={item.quantity}
                                    unitPriceMinor={item.unitPriceMinor}
                                    lineTotalMinor={item.totalMinor}
                                    currency={item.currency}
                                    showProductId
                                />
                            ))}
                        </div>
                    </section>
                </div>

                <aside className="space-y-6">
                    <OrderStatusControls
                        orderId={order.id}
                        currentStatus={order.status}
                    />

                    {refundRequest && (
                        <RefundRequestSection refundRequest={refundRequest} />
                    )}

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
                        <OrderSummaryBreakdown
                            subtotalMinor={order.subtotalMinor}
                            discountMinor={order.discountMinor}
                            shippingMinor={order.shippingMinor}
                            taxMinor={order.taxMinor}
                            totalMinor={order.totalMinor}
                            currency={order.currency}
                            discountNote={order.promotionCode ?? undefined}
                        />
                        {order.paidAt && (
                            <div className="pt-2 text-xs text-slate-500">
                                Paid at {formatDateTime(order.paidAt)}
                            </div>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
}
