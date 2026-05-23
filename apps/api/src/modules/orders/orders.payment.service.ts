import { prisma } from "@repo/db";
import {
    OrderStatus,
    PaymentStatus,
    type OrderDTO,
} from "@repo/shared";
import { AppError } from "../../lib/errors";
import { getStripe } from "../../lib/stripe";
import {
    ORDER_INCLUDE,
    STOCK_HELD,
    toOrderDTO,
} from "./orders.service";

export const ordersPaymentService = {
    /**
     * Admin-initiated refund (1.4).
     * Calls Stripe to create a refund, returns 202 with pending refund ID.
     * The actual DB status flip happens via the charge.refunded webhook (1.5).
     */
    async refundOrder(id: string): Promise<{ refundId: string }> {
        const stripe = getStripe();

        const order = await prisma.order.findUnique({
            where: { id },
            include: {
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

        if (!order) {
            throw AppError.notFound("NOT_FOUND", "Order not found");
        }

        const validPayment = order.payments[0];
        if (!validPayment?.providerPaymentId) {
            throw AppError.badRequest(
                "NO_PAYMENT",
                "No successful payment found for this order",
            );
        }

        // Only allow refund from PAID, PROCESSING, SHIPPED, DELIVERED
        const refundableStatuses: OrderStatus[] = [
            OrderStatus.PAID,
            OrderStatus.PROCESSING,
            OrderStatus.SHIPPED,
            OrderStatus.DELIVERED,
        ];
        if (!refundableStatuses.includes(order.status)) {
            throw AppError.badRequest(
                "INVALID_STATUS",
                `Cannot refund order with status '${order.status}'`,
            );
        }

        // Call Stripe to create refund
        const refund = await stripe.refunds.create({
            payment_intent: validPayment.providerPaymentId,
        });

        return { refundId: refund.id };
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

    /**
     * Webhook handler: mark order as REFUNDED when Stripe sends charge.refunded.
     * Updates payment status and restores inventory.
     */
    async markRefundedByPaymentIntent(
        paymentIntentId: string,
    ): Promise<OrderDTO | null> {
        const result = await prisma.$transaction(async (tx) => {
            const payment = await tx.payment.findUnique({
                where: { providerPaymentId: paymentIntentId },
                include: { order: { include: ORDER_INCLUDE } },
            });
            if (!payment) return null;

            const order = payment.order;
            // Only refund if currently in a held state (paid/processing/shipped/delivered)
            if (!STOCK_HELD.has(order.status as OrderStatus)) return order;

            const flipped = await tx.order.updateMany({
                where: { id: order.id, status: { in: [...STOCK_HELD] } },
                data: { status: OrderStatus.REFUNDED },
            });
            if (flipped.count !== 1) return order;

            await tx.payment.update({
                where: { id: payment.id },
                data: { status: PaymentStatus.REFUNDED },
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
