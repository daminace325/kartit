import { prisma } from "@repo/db";
import type { Prisma } from "@repo/db";
import {
    calculatePricing,
    ErrorCode,
    OrderStatus,
    PaymentStatus,
    type OrderDTO,
    type OrderCreateInput,
    type OrderListQuery,
    type OrderListResponse,
    type CreateOrderResponse,
} from "@repo/shared";
import { restoreInventory } from "@repo/db";
import { AppError } from "../../lib/errors";
import { env } from "../../config/env";
import { getStripe } from "../../lib/stripe";
import { promotionsService } from "../promotions/promotions.service";
import { generateOrderNumber, ORDER_INCLUDE, toOrderDTO } from "./orders.dto";
import { reserveInventory } from "./orders.inventory.service";
import { lockPromotion } from "./orders.promotion-lock";

// ── Re-exports for backward compatibility ─────────────────────────
export { ORDER_INCLUDE, toOrderDTO, generateOrderNumber, ALLOWED_TRANSITIONS } from "./orders.dto";
export { STOCK_HELD, STOCK_RELEASE, restoreInventory, shipInventory, reserveInventory } from "./orders.inventory.service";
export { lockPromotion } from "./orders.promotion-lock";

// ── Order CRUD ────────────────────────────────────────────────────

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
                                category: { select: { isActive: true } },
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

        // Re-validate active + available stock with current product rows (mirror /cart/summary).
        // Available = physicalStock - reservedQty (items already tied up in other active orders).
        for (const item of cart.items) {
            if (!item.product.isActive || !item.product.category.isActive || item.product.deletedAt) {
                throw AppError.conflict(
                    "PRODUCT_INACTIVE",
                    `Product "${item.product.name}" is no longer available`,
                );
            }
            // Re-fetch the latest available stock right before the transaction.
            // The advisory lock inside reserveInventory is the true gate — this is
            // a fast-fail check only.
            const fresh = await prisma.product.findUniqueOrThrow({
                where: { id: item.productId, deletedAt: null },
                select: { physicalStock: true, reservedQty: true },
            });
            const available = fresh.physicalStock - fresh.reservedQty;
            if (item.quantity > available) {
                throw AppError.conflict(
                    "INSUFFICIENT_STOCK",
                    `Only ${available} of "${item.product.name}" in stock`,
                );
            }
        }

        // Authoritative pricing — never trust client totals.
        const subtotal = cart.items.reduce(
            (acc, it) => acc + it.product.priceMinor * BigInt(it.quantity),
            0n,
        );
        const currency = cart.items[0].product.currency;

        let discountMinor = 0n;
        let promotionId: string | null = null;
        let appliedPromotionCode: string | null = null;

        if (input.promotionCode) {
            const promo = await promotionsService.validate(
                input.promotionCode,
                subtotal,
                userId,
            );
            if (!promo) {
                throw AppError.badRequest(
                    "PROMOTION_INVALID",
                    "Invalid or expired promotion code",
                );
            }
            discountMinor = promo.discountMinor;
            promotionId = promo.id;
            appliedPromotionCode = promo.code;
        }

        const pricing = calculatePricing({ subtotal, currency, discountMinor });

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
            // Re-check promotion usage limits under advisory lock. The
            // validate() call before the transaction is the fast path;
            // this is the authoritative gate that prevents concurrent
            // checkouts from overselling a limited promotion.
            if (promotionId) {
                await lockPromotion(tx, promotionId, userId);
            }

            // Reserve inventory under pg_advisory_xact_lock per product.
            // Locks are sorted by productId to prevent deadlocks. The lock
            // guarantees serialized access — exactly N out of M concurrent
            // checkouts will succeed for an N-stock SKU.
            await reserveInventory(tx, itemsSnapshot);

            const created = await tx.order.create({
                data: {
                    orderNumber,
                    userId,
                    status: OrderStatus.PENDING,
                    subtotalMinor: pricing.subtotal,
                    discountMinor: pricing.discount,
                    shippingMinor: pricing.shipping,
                    taxMinor: pricing.tax,
                    totalMinor: pricing.total,
                    promotionId,
                    promotionCode: appliedPromotionCode,
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

            // P2.3: outbox entry for OrderCreated → order-events queue
            await tx.outbox.create({
                data: {
                    aggregateType: "Order",
                    aggregateId: created.id,
                    eventType: "OrderCreated",
                    payload: {
                        orderNumber: created.orderNumber,
                        totalMinor: created.totalMinor.toString(),
                        currency: created.currency,
                        userId,
                    },
                },
            });

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

        let refundPaymentId: string | null = null;

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

            // Capture payment ID for refund after the transaction commits.
            // Stripe refunds must happen outside the DB transaction — a DB
            // rollback cannot undo money that has already been sent.
            if (existing.status !== OrderStatus.PENDING) {
                const payment = existing.payments[0];
                refundPaymentId = payment?.providerPaymentId ?? null;
            }

            // P2.3: outbox entry for OrderCancelled → order-events queue
            await tx.outbox.create({
                data: {
                    aggregateType: "Order",
                    aggregateId: id,
                    eventType: "OrderCancelled",
                    payload: {
                        wasPaid: existing.status !== OrderStatus.PENDING,
                        userId,
                    },
                },
            });

            return tx.order.findUniqueOrThrow({
                where: { id },
                include: ORDER_INCLUDE,
            });
        });

        // Refund via Stripe outside the transaction — DB rollback can't undo
        // money movement. The idempotency key makes it safe to retry if this
        // call or the subsequent payment update fails.
        if (refundPaymentId) {
            const stripe = getStripe();
            await stripe.refunds.create(
                { payment_intent: refundPaymentId },
                { idempotencyKey: `refund_${id}` },
            );
            // The charge.refunded webhook won't match because CANCELLED is
            // outside STOCK_HELD, so mark the payment as refunded now.
            await prisma.payment.update({
                where: { providerPaymentId: refundPaymentId },
                data: { status: PaymentStatus.REFUNDED },
            });
        }

        return toOrderDTO(updated);
    },
};
