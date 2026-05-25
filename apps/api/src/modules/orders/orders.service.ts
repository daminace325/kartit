import crypto from "node:crypto";
import { prisma } from "@repo/db";
import type { Prisma } from "@repo/db";
import {
    calculatePricing,
    ErrorCode,
    OrderStatus,
    PaymentStatus,
    VALID_STATUS_TRANSITIONS,
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

function generateOrderNumber(): string {
    const today = new Date();
    const y = today.getFullYear().toString();
    const m = (today.getMonth() + 1).toString().padStart(2, "0");
    const d = today.getDate().toString().padStart(2, "0");
    const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
    return `ECM-${y}${m}${d}-${suffix}`;
}

type OrderWithItems = Prisma.OrderGetPayload<{
    include: { items: true };
}>;

export const ORDER_INCLUDE = {
    items: { orderBy: { id: "asc" as const } },
} satisfies Prisma.OrderInclude;

// Statuses for which inventory has already been deducted.
// Transitioning from one of these into a release status restores stock.
export const STOCK_HELD: ReadonlySet<OrderStatus> = new Set([
    OrderStatus.PENDING,
    OrderStatus.PAID,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
]);
export const STOCK_RELEASE: ReadonlySet<OrderStatus> = new Set([
    OrderStatus.CANCELLED,
    OrderStatus.FAILED,
    OrderStatus.REFUNDED,
]);

// Allowed admin-driven status transitions. Customer-initiated cancel uses
// the dedicated cancel route and is restricted to PENDING in Phase 1.
// Sourced from @repo/shared so the client and server share one definition.
export const ALLOWED_TRANSITIONS: Record<OrderStatus, ReadonlySet<OrderStatus>> =
    Object.fromEntries(
        Object.entries(VALID_STATUS_TRANSITIONS).map(([key, values]) => [
            key,
            new Set(values),
        ]),
    ) as unknown as Record<OrderStatus, ReadonlySet<OrderStatus>>;

export function toItemDTO(item: OrderWithItems["items"][number]): OrderItemDTO {
    return {
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        productSlug: item.productSlug,
        imageUrl: item.imageUrl,
        unitPriceMinor: item.unitPriceMinor.toString(),
        currency: item.currency,
        quantity: item.quantity,
        totalMinor: item.totalMinor.toString(),
    };
}

export function toOrderDTO(order: OrderWithItems): OrderDTO {
    return {
        id: order.id,
        orderNumber: order.orderNumber,
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
        deliveredAt: order.deliveredAt ? order.deliveredAt.toISOString() : null,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
    };
}

export async function restoreInventory(
    tx: Prisma.TransactionClient,
    items: Array<{ productId: string; quantity: number }>,
): Promise<void> {
    for (const item of items) {
        await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
        });
    }
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
                    include: {
                        product: {
                            include: {
                                images: {
                                    orderBy: { position: "asc" },
                                    take: 1,
                                },
                            },
                        },
                    },
                    orderBy: { createdAt: "asc" },
                },
            },
        });

        if (!cart || cart.items.length === 0) {
            throw AppError.badRequest("CART_EMPTY", "Cart is empty");
        }

        // Re-validate active + stock with current product rows (mirror /cart/summary).
        for (const item of cart.items) {
            if (!item.product.isActive || item.product.deletedAt) {
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
        const orderNumber = generateOrderNumber();
        const itemsSnapshot = cart.items.map((it) => ({
            productId: it.productId,
            productName: it.product.name,
            productSlug: it.product.slug,
            imageUrl: it.product.images[0]?.url ?? null,
            unitPriceMinor: it.product.priceMinor,
            currency: it.product.currency,
            quantity: it.quantity,
            totalMinor: it.product.priceMinor * BigInt(it.quantity),
        }));

        const order = await prisma.$transaction(async (tx) => {
            // Atomic conditional decrement per line. If any product was
            // taken below the requested quantity by a concurrent order,
            // updateMany returns count 0 → throw INSUFFICIENT_STOCK; the
            // surrounding transaction rolls back any earlier decrements.
            for (const it of itemsSnapshot) {
                const result = await tx.product.updateMany({
                    where: { id: it.productId, deletedAt: null, stock: { gte: it.quantity } },
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
                    orderNumber,
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
                            productSlug: it.productSlug,
                            imageUrl: it.imageUrl,
                            unitPriceMinor: it.unitPriceMinor,
                            currency: it.currency,
                            quantity: it.quantity,
                            totalMinor: it.totalMinor,
                        })),
                    },
                    payments: {
                        create: {
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

        return { order: toOrderDTO(order) };
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
        const cancellableStatuses: OrderStatus[] = [
            OrderStatus.PENDING,
            OrderStatus.PAID,
            OrderStatus.PROCESSING,
        ];

        const updated = await prisma.$transaction(async (tx) => {
            const existing = await tx.order.findUnique({
                where: { id },
                include: {
                    ...ORDER_INCLUDE,
                    payments: {
                        where: {
                            status: PaymentStatus.SUCCEEDED,
                            providerPaymentId: { not: null },
                        },
                        orderBy: { createdAt: "desc" },
                        take: 1,
                    },
                },
            });
            if (!existing) {
                throw AppError.notFound("NOT_FOUND", "Order not found");
            }
            if (!isAdmin && existing.userId !== userId) {
                throw AppError.forbidden();
            }

            if (!cancellableStatuses.includes(existing.status)) {
                if (existing.status === OrderStatus.SHIPPED) {
                    throw AppError.conflict(
                        "SHIPPED_CANNOT_CANCEL",
                        "Shipped items cannot be cancelled. Please request a refund after delivery.",
                    );
                }
                throw AppError.conflict(
                    ErrorCode.ORDER_INVALID_STATE,
                    `Order cannot be cancelled in status '${existing.status}'`,
                );
            }

            // Mark CANCELLED first via conditional update — this prevents
            // concurrent cancellations from issuing duplicate Stripe refunds.
            const result = await tx.order.updateMany({
                where: { id, status: { in: cancellableStatuses } },
                data: { status: OrderStatus.CANCELLED },
            });
            if (result.count !== 1) {
                throw AppError.conflict(
                    ErrorCode.ORDER_INVALID_STATE,
                    "Order status changed, refresh and retry",
                );
            }

            await restoreInventory(tx, existing.items);

            // For PAID/PROCESSING: refund via Stripe. If Stripe fails the
            // transaction rolls back, reverting the order to its prior state.
            if (existing.status !== OrderStatus.PENDING) {
                const payment = existing.payments[0];
                if (payment?.providerPaymentId) {
                    const stripe = getStripe();
                    await stripe.refunds.create({
                        payment_intent: payment.providerPaymentId,
                    });
                    // Mark payment as refunded now. The charge.refunded webhook
                    // won't match because CANCELLED is outside STOCK_HELD.
                    await tx.payment.update({
                        where: { id: payment.id },
                        data: { status: PaymentStatus.REFUNDED },
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
};
