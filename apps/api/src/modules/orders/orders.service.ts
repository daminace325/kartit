import { prisma } from "@repo/db";
import type { Prisma } from "@repo/db";
import {
    calculatePricing,
    OrderStatus,
    PaymentStatus,
    type OrderDTO,
    type OrderCreateInput,
    type OrderItemDTO,
    type OrderListQuery,
    type OrderListResponse,
    type CreateOrderResponse,
} from "@repo/shared";
import { AppError } from "../../lib/errors";
import { env } from "../../config/env";
import { getStripe } from "../../lib/stripe";

type OrderWithItems = Prisma.OrderGetPayload<{
    include: { items: true };
}>;

const ORDER_INCLUDE = {
    items: { orderBy: { id: "asc" as const } },
} satisfies Prisma.OrderInclude;

// Statuses for which inventory has already been deducted.
// Transitioning from one of these into a release status restores stock.
const STOCK_HELD: ReadonlySet<OrderStatus> = new Set([
    OrderStatus.PENDING,
    OrderStatus.PAID,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
]);
const STOCK_RELEASE: ReadonlySet<OrderStatus> = new Set([
    OrderStatus.CANCELLED,
    OrderStatus.FAILED,
    OrderStatus.REFUNDED,
]);

// Allowed admin-driven status transitions. Customer-initiated cancel uses
// the dedicated cancel route and is restricted to PENDING in Phase 1.
const ALLOWED_TRANSITIONS: Record<OrderStatus, ReadonlySet<OrderStatus>> = {
    [OrderStatus.PENDING]: new Set([
        OrderStatus.PAID,
        OrderStatus.CANCELLED,
        OrderStatus.FAILED,
    ]),
    [OrderStatus.PAID]: new Set([
        OrderStatus.PROCESSING,
        OrderStatus.CANCELLED,
        OrderStatus.REFUNDED,
    ]),
    [OrderStatus.PROCESSING]: new Set([
        OrderStatus.SHIPPED,
        OrderStatus.CANCELLED,
        OrderStatus.REFUNDED,
    ]),
    [OrderStatus.SHIPPED]: new Set([
        OrderStatus.DELIVERED,
        OrderStatus.REFUNDED,
    ]),
    [OrderStatus.DELIVERED]: new Set([OrderStatus.REFUNDED]),
    [OrderStatus.CANCELLED]: new Set<OrderStatus>(),
    [OrderStatus.FAILED]: new Set<OrderStatus>(),
    [OrderStatus.REFUNDED]: new Set<OrderStatus>(),
};

function toItemDTO(item: OrderWithItems["items"][number]): OrderItemDTO {
    return {
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        unitPriceMinor: item.unitPriceMinor.toString(),
        currency: item.currency,
        quantity: item.quantity,
        totalMinor: item.totalMinor.toString(),
    };
}

function toOrderDTO(order: OrderWithItems): OrderDTO {
    return {
        id: order.id,
        userId: order.userId,
        status: order.status as OrderStatus,
        subtotalMinor: order.subtotalMinor.toString(),
        shippingMinor: order.shippingMinor.toString(),
        taxMinor: order.taxMinor.toString(),
        totalMinor: order.totalMinor.toString(),
        currency: order.currency,
        shippingName: order.shippingName,
        shippingPhone: order.shippingPhone,
        shippingLine1: order.shippingLine1,
        shippingLine2: order.shippingLine2,
        shippingCity: order.shippingCity,
        shippingState: order.shippingState,
        shippingPostalCode: order.shippingPostalCode,
        shippingCountry: order.shippingCountry,
        items: order.items.map(toItemDTO),
        paidAt: order.paidAt ? order.paidAt.toISOString() : null,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
    };
}

export const ordersService = {
    async create(
        userId: string,
        input: OrderCreateInput,
    ): Promise<CreateOrderResponse> {
        const shippingAddress = await prisma.address.findUnique({
            where: { id: input.shippingAddressId },
        });
        if (!shippingAddress || shippingAddress.userId !== userId) {
            throw AppError.notFound("ADDRESS_NOT_FOUND", "Shipping address not found");
        }

        const cart = await prisma.cart.findUnique({
            where: { userId },
            include: {
                items: {
                    include: { product: true },
                    orderBy: { createdAt: "asc" },
                },
            },
        });

        if (!cart || cart.items.length === 0) {
            throw AppError.badRequest("CART_EMPTY", "Cart is empty");
        }

        // Re-validate active + stock with current product rows (mirror /cart/summary).
        for (const item of cart.items) {
            if (!item.product.isActive) {
                throw AppError.conflict(
                    "PRODUCT_INACTIVE",
                    `Product "${item.product.name}" is no longer available`,
                );
            }
            if (item.quantity > item.product.stock) {
                throw AppError.conflict(
                    "INSUFFICIENT_STOCK",
                    `Only ${item.product.stock} of "${item.product.name}" in stock`,
                );
            }
        }

        // Authoritative pricing — never trust client totals.
        const subtotal = cart.items.reduce(
            (acc, it) => acc + it.product.priceMinor * BigInt(it.quantity),
            0n,
        );
        const currency = cart.items[0].product.currency;
        const pricing = calculatePricing({ subtotal, currency });

        // Phase 1 only supports a single Stripe currency. Reject mismatched
        // catalog currencies up front rather than at Stripe API time.
        if (pricing.currency !== env.STRIPE_CURRENCY) {
            throw AppError.badRequest(
                "UNSUPPORTED_CURRENCY",
                `Checkout currently supports ${env.STRIPE_CURRENCY} only`,
            );
        }

        const cartId = cart.id;
        const itemsSnapshot = cart.items.map((it) => ({
            productId: it.productId,
            productName: it.product.name,
            unitPriceMinor: it.product.priceMinor,
            currency: it.product.currency,
            quantity: it.quantity,
            totalMinor: it.product.priceMinor * BigInt(it.quantity),
        }));

        // 1. Create the PaymentIntent BEFORE the DB transaction. If the
        // surrounding tx fails (e.g. concurrent stock conflict), we cancel
        // the PI best-effort below so we don't leave orphan intents.
        const stripe = getStripe();
        const intent = await stripe.paymentIntents.create({
            amount: Number(pricing.total),
            currency: pricing.currency.toLowerCase(),
            automatic_payment_methods: { enabled: true },
            metadata: { userId },
        });

        let order: OrderWithItems;
        try {
            order = await prisma.$transaction(async (tx) => {
                // Atomic conditional decrement per line. If any product was
                // taken below the requested quantity by a concurrent order,
                // updateMany returns count 0 → throw INSUFFICIENT_STOCK; the
                // surrounding transaction rolls back any earlier decrements.
                for (const it of itemsSnapshot) {
                    const result = await tx.product.updateMany({
                        where: { id: it.productId, stock: { gte: it.quantity } },
                        data: { stock: { decrement: it.quantity } },
                    });
                    if (result.count !== 1) {
                        throw AppError.conflict(
                            "INSUFFICIENT_STOCK",
                            `Insufficient stock for "${it.productName}"`,
                        );
                    }
                }

                const created = await tx.order.create({
                    data: {
                        userId,
                        status: OrderStatus.PENDING,
                        subtotalMinor: pricing.subtotal,
                        shippingMinor: pricing.shipping,
                        taxMinor: pricing.tax,
                        totalMinor: pricing.total,
                        currency: pricing.currency,
                        shippingName: shippingAddress.name,
                        shippingPhone: shippingAddress.phone,
                        shippingLine1: shippingAddress.line1,
                        shippingLine2: shippingAddress.line2,
                        shippingCity: shippingAddress.city,
                        shippingState: shippingAddress.state,
                        shippingPostalCode: shippingAddress.postalCode,
                        shippingCountry: shippingAddress.country ?? "",
                        items: {
                            create: itemsSnapshot.map((it) => ({
                                productId: it.productId,
                                productName: it.productName,
                                unitPriceMinor: it.unitPriceMinor,
                                currency: it.currency,
                                quantity: it.quantity,
                                totalMinor: it.totalMinor,
                            })),
                        },
                        payments: {
                            create: {
                                providerPaymentId: intent.id,
                                status: PaymentStatus.REQUIRES_PAYMENT,
                                amountMinor: pricing.total,
                                currency: pricing.currency,
                            },
                        },
                    },
                    include: ORDER_INCLUDE,
                });

                await tx.cartItem.deleteMany({ where: { cartId } });

                return created;
            });
        } catch (err) {
            // Best-effort cancellation so we don't leak an unconsumable PI.
            stripe.paymentIntents
                .cancel(intent.id)
                .catch((e: unknown) => console.error("stripe cancel failed", e));
            throw err;
        }

        // Best-effort: attach the now-known orderId so the webhook can
        // resolve the order even if the providerPaymentId lookup ever drifts.
        stripe.paymentIntents
            .update(intent.id, { metadata: { userId, orderId: order.id } })
            .catch((e: unknown) => console.error("stripe metadata update failed", e));

        return {
            order: toOrderDTO(order),
            clientSecret: intent.client_secret ?? undefined,
        };
    },

    async list(
        userId: string,
        isAdmin: boolean,
        query: OrderListQuery,
    ): Promise<OrderListResponse> {
        const { cursor, limit } = query;

        const where: Prisma.OrderWhereInput = isAdmin ? {} : { userId };

        const rows = await prisma.order.findMany({
            where,
            include: ORDER_INCLUDE,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });

        const hasNext = rows.length > limit;
        const items = (hasNext ? rows.slice(0, limit) : rows).map(toOrderDTO);
        const nextCursor = hasNext ? items[items.length - 1].id : null;

        return { items, nextCursor };
    },

    async getById(
        userId: string,
        isAdmin: boolean,
        id: string,
    ): Promise<OrderDTO> {
        const order = await prisma.order.findUnique({
            where: { id },
            include: ORDER_INCLUDE,
        });
        if (!order) throw AppError.notFound("NOT_FOUND", "Order not found");
        if (!isAdmin && order.userId !== userId) {
            throw AppError.forbidden();
        }
        return toOrderDTO(order);
    },

    async cancel(
        userId: string,
        isAdmin: boolean,
        id: string,
    ): Promise<OrderDTO> {
        const updated = await prisma.$transaction(async (tx) => {
            const existing = await tx.order.findUnique({
                where: { id },
                include: ORDER_INCLUDE,
            });
            if (!existing) {
                throw AppError.notFound("NOT_FOUND", "Order not found");
            }
            if (!isAdmin && existing.userId !== userId) {
                throw AppError.forbidden();
            }

            // Phase 1: customers can only cancel PENDING orders. PAID
            // refund flow is sub-phase 1.8 (Stripe), driven by admin
            // status transitions.
            if (existing.status !== OrderStatus.PENDING) {
                throw AppError.conflict(
                    "INVALID_STATUS_TRANSITION",
                    `Order cannot be cancelled in status '${existing.status}'`,
                );
            }

            // Conditional update to guard against concurrent state changes.
            const result = await tx.order.updateMany({
                where: { id, status: OrderStatus.PENDING },
                data: { status: OrderStatus.CANCELLED },
            });
            if (result.count !== 1) {
                throw AppError.conflict(
                    "INVALID_STATUS_TRANSITION",
                    "Order status changed, refresh and retry",
                );
            }

            // Restore inventory (PENDING was a stock-held status).
            for (const item of existing.items) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { increment: item.quantity } },
                });
            }

            return tx.order.findUniqueOrThrow({
                where: { id },
                include: ORDER_INCLUDE,
            });
        });

        return toOrderDTO(updated);
    },

    async adminUpdateStatus(
        id: string,
        next: OrderStatus,
    ): Promise<OrderDTO> {
        const updated = await prisma.$transaction(async (tx) => {
            const existing = await tx.order.findUnique({
                where: { id },
                include: ORDER_INCLUDE,
            });
            if (!existing) {
                throw AppError.notFound("NOT_FOUND", "Order not found");
            }

            const current = existing.status as OrderStatus;
            if (current === next) {
                return existing;
            }

            const allowed = ALLOWED_TRANSITIONS[current];
            if (!allowed.has(next)) {
                throw AppError.conflict(
                    "INVALID_STATUS_TRANSITION",
                    `Cannot transition order from '${current}' to '${next}'`,
                );
            }

            const result = await tx.order.updateMany({
                where: { id, status: current },
                data: {
                    status: next,
                    ...(next === OrderStatus.PAID && !existing.paidAt
                        ? { paidAt: new Date() }
                        : {}),
                },
            });
            if (result.count !== 1) {
                throw AppError.conflict(
                    "INVALID_STATUS_TRANSITION",
                    "Order status changed, refresh and retry",
                );
            }

            // Restore stock when transitioning held → release.
            if (STOCK_HELD.has(current) && STOCK_RELEASE.has(next)) {
                for (const item of existing.items) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stock: { increment: item.quantity } },
                    });
                }
            }

            return tx.order.findUniqueOrThrow({
                where: { id },
                include: ORDER_INCLUDE,
            });
        });

        return toOrderDTO(updated);
    },

    /**
     * Webhook handler: mark the order tied to this PaymentIntent as PAID.
     * Idempotent — the conditional updateMany on `status = PENDING` makes
     * repeated deliveries no-ops. Returns null if no order found (logged
     * by caller; we ack to Stripe regardless to prevent retries on garbage).
     */
    async markPaidByPaymentIntent(paymentIntentId: string): Promise<OrderDTO | null> {
        const result = await prisma.$transaction(async (tx) => {
            const payment = await tx.payment.findUnique({
                where: { providerPaymentId: paymentIntentId },
                include: { order: { include: ORDER_INCLUDE } },
            });
            if (!payment) return null;

            const order = payment.order;

            // Idempotent: already paid → return current state, no writes.
            if (order.status === OrderStatus.PAID) return order;

            // Only flip from PENDING; other statuses (CANCELLED, FAILED)
            // mean the order was already resolved another way.
            if (order.status !== OrderStatus.PENDING) return order;

            const flipped = await tx.order.updateMany({
                where: { id: order.id, status: OrderStatus.PENDING },
                data: { status: OrderStatus.PAID, paidAt: new Date() },
            });
            if (flipped.count !== 1) return order;

            await tx.payment.update({
                where: { id: payment.id },
                data: { status: PaymentStatus.SUCCEEDED },
            });

            return tx.order.findUniqueOrThrow({
                where: { id: order.id },
                include: ORDER_INCLUDE,
            });
        });

        return result ? toOrderDTO(result) : null;
    },

    /**
     * Webhook handler: mark the order tied to this PaymentIntent as FAILED
     * and restore stock (PENDING was a stock-held status). Idempotent.
     */
    async markFailedByPaymentIntent(
        paymentIntentId: string,
        failureReason?: string,
    ): Promise<OrderDTO | null> {
        const result = await prisma.$transaction(async (tx) => {
            const payment = await tx.payment.findUnique({
                where: { providerPaymentId: paymentIntentId },
                include: { order: { include: ORDER_INCLUDE } },
            });
            if (!payment) return null;

            const order = payment.order;
            if (order.status !== OrderStatus.PENDING) return order;

            const flipped = await tx.order.updateMany({
                where: { id: order.id, status: OrderStatus.PENDING },
                data: { status: OrderStatus.FAILED },
            });
            if (flipped.count !== 1) return order;

            await tx.payment.update({
                where: { id: payment.id },
                data: {
                    status: PaymentStatus.FAILED,
                    failureReason: failureReason ?? null,
                },
            });

            // Restore inventory.
            for (const item of order.items) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { stock: { increment: item.quantity } },
                });
            }

            return tx.order.findUniqueOrThrow({
                where: { id: order.id },
                include: ORDER_INCLUDE,
            });
        });

        return result ? toOrderDTO(result) : null;
    },
};
