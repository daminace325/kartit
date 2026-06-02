import { Worker } from "bullmq";
import { prisma } from "@repo/db";
import {
    OrderStatus,
    PaymentStatus,
} from "@repo/shared";
import { REDIS_URL } from "../lib/redis";

/**
 * Processes webhook-retry jobs from the "webhooks-retry" queue.
 *
 * When the API fails to process a Stripe webhook on first delivery it
 * enqueues a retry here. This worker reads the stored WebhookEvent,
 * extracts the Stripe event data, and re-attempts the business-logic
 * side effects (order/payment status transitions, inventory, outbox).
 *
 * Weaveraged from P2.3 log-only skeleton to fully wired in P2.9.
 */

// Statuses for which inventory is held (the "stock-is-out" set).
// Duplicated here so the worker stays self-contained — the canonical
// definition lives in apps/api.
const STOCK_HELD: readonly OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.PAID,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
];

// ── Handler helpers ────────────────────────────────────────────

interface StripeEventPayload {
    type: string;
    data: {
        object: {
            id: string;
            payment_intent?: string;
            last_payment_error?: {
                message?: string;
                code?: string;
            };
        };
    };
}

async function handlePaymentIntentSucceeded(
    paymentIntentId: string,
): Promise<void> {
    const payment = await prisma.payment.findUnique({
        where: { providerPaymentId: paymentIntentId },
        include: { order: { include: { items: true } } },
    });

    if (!payment) {
        console.log(
            `[webhooks-retry] payment_intent.succeeded — unknown PI ${paymentIntentId}`,
        );
        return;
    }

    const order = payment.order;

    // Idempotent: already PAID
    if (order.status === OrderStatus.PAID) return;

    // Only flip from PENDING
    if (order.status !== OrderStatus.PENDING) {
        console.log(
            `[webhooks-retry] payment_intent.succeeded — order ${order.id} not PENDING (status=${order.status}), skipping`,
        );
        return;
    }

    await prisma.$transaction(async (tx) => {
        const flipped = await tx.order.updateMany({
            where: { id: order.id, status: OrderStatus.PENDING },
            data: { status: OrderStatus.PAID, paidAt: new Date() },
        });
        if (flipped.count !== 1) return;

        await tx.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.SUCCEEDED },
        });

        await tx.outbox.create({
            data: {
                aggregateType: "Order",
                aggregateId: order.id,
                eventType: "OrderPaid",
                payload: {
                    orderNumber: order.orderNumber,
                    totalMinor: order.totalMinor.toString(),
                    currency: order.currency,
                    userId: order.userId,
                    providerPaymentId: payment.providerPaymentId,
                },
            },
        });
    });

    console.log(
        `[webhooks-retry] payment_intent.succeeded — order ${order.id} marked PAID`,
    );
}

async function handlePaymentIntentFailed(
    paymentIntentId: string,
    reason?: string,
): Promise<void> {
    const payment = await prisma.payment.findUnique({
        where: { providerPaymentId: paymentIntentId },
        include: { order: { include: { items: true } } },
    });

    if (!payment) {
        console.log(
            `[webhooks-retry] payment_intent.payment_failed — unknown PI ${paymentIntentId}`,
        );
        return;
    }

    const order = payment.order;

    if (order.status !== OrderStatus.PENDING) return;

    await prisma.$transaction(async (tx) => {
        const flipped = await tx.order.updateMany({
            where: { id: order.id, status: OrderStatus.PENDING },
            data: { status: OrderStatus.FAILED },
        });
        if (flipped.count !== 1) return;

        await tx.payment.update({
            where: { id: payment.id },
            data: {
                status: PaymentStatus.FAILED,
                failureReason: reason ?? null,
            },
        });

        // Release reservation
        for (const item of order.items) {
            await tx.product.update({
                where: { id: item.productId },
                data: { reservedQty: { decrement: item.quantity } },
            });
        }

        await tx.outbox.create({
            data: {
                aggregateType: "Order",
                aggregateId: order.id,
                eventType: "OrderPaymentFailed",
                payload: {
                    orderNumber: order.orderNumber,
                    failureReason:
                        reason ?? "Payment failed",
                    totalMinor: order.totalMinor.toString(),
                    currency: order.currency,
                    userId: order.userId,
                    providerPaymentId: payment.providerPaymentId,
                },
            },
        });
    });

    console.log(
        `[webhooks-retry] payment_intent.payment_failed — order ${order.id} marked FAILED`,
    );
}

async function handleChargeRefunded(
    paymentIntentId: string,
): Promise<void> {
    const payment = await prisma.payment.findUnique({
        where: { providerPaymentId: paymentIntentId },
        include: { order: { include: { items: true } } },
    });

    if (!payment) {
        console.log(
            `[webhooks-retry] charge.refunded — unknown PI ${paymentIntentId}`,
        );
        return;
    }

    const order = payment.order;

    if (payment.status !== PaymentStatus.SUCCEEDED) return;
    if (!STOCK_HELD.includes(order.status as OrderStatus)) return;

    await prisma.$transaction(async (tx) => {
        const flipped = await tx.order.updateMany({
            where: { id: order.id, status: { in: [...STOCK_HELD] } },
            data: { status: OrderStatus.REFUNDED },
        });
        if (flipped.count !== 1) return;

        await tx.payment.update({
            where: { id: payment.id },
            data: { status: PaymentStatus.REFUNDED },
        });

        const wasShipped =
            order.status === OrderStatus.SHIPPED ||
            order.status === OrderStatus.DELIVERED;

        for (const item of order.items) {
            if (wasShipped) {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { physicalStock: { increment: item.quantity } },
                });
            } else {
                await tx.product.update({
                    where: { id: item.productId },
                    data: { reservedQty: { decrement: item.quantity } },
                });
            }
        }

        await tx.outbox.create({
            data: {
                aggregateType: "Order",
                aggregateId: order.id,
                eventType: "OrderRefunded",
                payload: {
                    orderNumber: order.orderNumber,
                    totalMinor: order.totalMinor.toString(),
                    currency: order.currency,
                    userId: order.userId,
                    providerPaymentId: payment.providerPaymentId,
                },
            },
        });
    });

    console.log(
        `[webhooks-retry] charge.refunded — order ${order.id} marked REFUNDED`,
    );
}

// ── Worker ──────────────────────────────────────────────────────

const worker = new Worker(
    "webhooks-retry",
    async (job) => {
        const { webhookEventId } = job.data;

        if (!webhookEventId) {
            console.log(
                "[webhooks-retry] missing webhookEventId in job data, skipping",
            );
            return;
        }

        const event = await prisma.webhookEvent.findUnique({
            where: { id: webhookEventId },
            select: { id: true, type: true, payload: true, processedAt: true, attempts: true },
        });

        if (!event) {
            console.log(
                `[webhooks-retry] webhookEvent ${webhookEventId} not found, skipping`,
            );
            return;
        }

        if (event.processedAt) {
            console.log(
                `[webhooks-retry] webhookEvent ${webhookEventId} already processed, skipping`,
            );
            return;
        }

        const payload = event.payload as unknown as StripeEventPayload;

        console.log(
            `[webhooks-retry] processing eventId=${webhookEventId} type=${payload.type} attempt=${event.attempts + 1}`,
        );

        switch (payload.type) {
            case "payment_intent.succeeded": {
                const piId = payload.data.object.id;
                await handlePaymentIntentSucceeded(piId);
                break;
            }
            case "payment_intent.payment_failed": {
                const piId = payload.data.object.id;
                const reason =
                    payload.data.object.last_payment_error?.message ??
                    payload.data.object.last_payment_error?.code;
                await handlePaymentIntentFailed(piId, reason);
                break;
            }
            case "charge.refunded": {
                const piId =
                    payload.data.object.payment_intent ?? "";
                await handleChargeRefunded(piId);
                break;
            }
            default:
                console.log(
                    `[webhooks-retry] unhandled event type: ${payload.type}`,
                );
                break;
        }

        // Mark processed on success.
        await prisma.webhookEvent.update({
            where: { id: webhookEventId },
            data: { processedAt: new Date() },
        });

        console.log(
            `[webhooks-retry] successfully processed webhookEventId=${webhookEventId}`,
        );
    },
    {
        connection: { url: REDIS_URL },
        concurrency: 5,
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: { age: 30 * 24 * 3600 },
    },
);

worker.on("failed", async (job, err) => {
    const webhookEventId = job?.data?.webhookEventId as string | undefined;
    console.error(
        `[webhooks-retry] job failed id=${job?.id} webhookEventId=${webhookEventId} err=${err.message}`,
    );

    // Update lastError on the WebhookEvent so ops can diagnose.
    if (webhookEventId && job) {
        const attempts = job.attemptsMade;
        try {
            await prisma.webhookEvent.update({
                where: { id: webhookEventId },
                data: {
                    attempts,
                    lastError: err.message.slice(0, 2000),
                    nextAttemptAt: null,
                },
            });
        } catch (updateErr) {
            console.error(
                `[webhooks-retry] failed to update lastError for ${webhookEventId}: ${(updateErr as Error).message}`,
            );
        }
    }
});

worker.on("error", (err) => {
    console.error(`[webhooks-retry] worker error: ${err.message}`);
});

export { worker as webhooksRetryWorker };
