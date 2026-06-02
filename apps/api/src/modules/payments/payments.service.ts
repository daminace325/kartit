import { Prisma, prisma } from "@repo/db";
import type Stripe from "stripe";
import {
    OrderStatus,
    type PaymentIntentResponse,
} from "@repo/shared";
import { env } from "../../config/env";
import { AppError } from "../../lib/errors";
import { getStripe } from "../../lib/stripe";
import { logger } from "../../lib/logger";
import { webhooksRetryQueue } from "../../lib/queue";
import { ordersPaymentService } from "../orders/orders.payment.service";
import { ordersService } from "../orders/orders.service";

// ── Backoff helper ─────────────────────────────────────────────
// Exponential backoff: start at 10 s, double each retry, cap at 24 h.

function backoffDelay(attempt: number): number {
    return Math.min(10_000 * Math.pow(2, attempt - 1), 86_400_000);
}

export const paymentsService = {
    /**
     * Process an incoming Stripe webhook event. Handles signature verification,
     * idempotency (duplicate detection), event-type routing, and marking the
     * event as processed. Returns `{ duplicate }` so the controller can
     * respond appropriately without leaking service logic.
     */
    async processWebhook(payload: Buffer, signature: string) {
        if (!env.STRIPE_WEBHOOK_SECRET) {
            throw AppError.internal(
                "STRIPE_NOT_CONFIGURED",
                "STRIPE_WEBHOOK_SECRET is not set",
            );
        }

        const stripe = getStripe();
        let event: Stripe.Event;
        try {
            event = stripe.webhooks.constructEvent(
                payload,
                signature,
                env.STRIPE_WEBHOOK_SECRET,
            );
        } catch (err) {
            const msg =
                err instanceof Error ? err.message : "verification failed";
            throw AppError.badRequest("INVALID_SIGNATURE", msg);
        }

        let webhookEventId: string;
        try {
            const row = await prisma.webhookEvent.create({
                data: {
                    provider: "stripe",
                    eventId: event.id,
                    type: event.type,
                    payload: event as unknown as Prisma.InputJsonValue,
                },
                select: { id: true },
            });
            webhookEventId = row.id;
        } catch (err) {
            if (
                err instanceof Prisma.PrismaClientKnownRequestError &&
                err.code === "P2002"
            ) {
                return { duplicate: true as const };
            }
            throw err;
        }

        // ── Dispatch to handler ────────────────────────────────
        // Wrapped in try/catch so a transient handler failure does not
        // permanently lose the event: we store the error, enqueue a retry
        // job to the webhooks-retry queue, and still return 200 to Stripe
        // (the event was received — our internal pipeline will reprocess).
        try {
            switch (event.type) {
                case "payment_intent.succeeded": {
                    const intent = event.data.object as Stripe.PaymentIntent;
                    const order = await ordersPaymentService.markPaidByPaymentIntent(intent.id);
                    if (!order) {
                        logger.warn(
                            `[stripe] payment_intent.succeeded for unknown intent ${intent.id}`,
                        );
                    }
                    break;
                }
                case "payment_intent.payment_failed": {
                    const intent = event.data.object as Stripe.PaymentIntent;
                    const reason =
                        intent.last_payment_error?.message ??
                        intent.last_payment_error?.code ??
                        undefined;
                    const order = await ordersPaymentService.markFailedByPaymentIntent(
                        intent.id,
                        reason,
                    );
                    if (!order) {
                        logger.warn(
                            `[stripe] payment_intent.payment_failed for unknown intent ${intent.id}`,
                        );
                    }
                    break;
                }
                case "charge.refunded": {
                    const charge = event.data.object as Stripe.Charge;
                    const paymentIntentId = charge.payment_intent as string;
                    const order = await ordersPaymentService.markRefundedByPaymentIntent(
                        paymentIntentId,
                    );
                    if (!order) {
                        logger.warn(
                            `[stripe] charge.refunded for unknown payment intent ${paymentIntentId}`,
                        );
                    }
                    break;
                }
                default:
                    break;
            }
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : String(err);
            const newAttempts = 1; // first failure

            logger.error(
                `[stripe] webhook processing failed eventId=${event.id} type=${event.type} err=${errorMessage} — enqueuing retry`,
            );

            // Store error info and enqueue a retry. The webhooks-retry
            // worker will pick this up and re-attempt with backoff.
            const delay = backoffDelay(newAttempts);

            await prisma.webhookEvent.update({
                where: { id: webhookEventId },
                data: {
                    attempts: newAttempts,
                    lastError: errorMessage,
                    nextAttemptAt: new Date(Date.now() + delay),
                },
            });

            // Fire-and-forget enqueue. If Redis is unreachable we still
            // have the WebhookEvent row updated with nextAttemptAt — ops
            // can manually retry via POST /admin/webhooks/:id/retry.
            try {
                await webhooksRetryQueue.add(
                    "webhook.retry",
                    { webhookEventId },
                    { delay },
                );
            } catch (queueErr) {
                logger.error(
                    `[stripe] failed to enqueue retry for eventId=${event.id}: ${(queueErr as Error).message}`,
                );
            }

            // Return 200 so Stripe doesn't retry the event (our pipeline
            // handles it). The event was *received* — just not processed yet.
            return { duplicate: false as const };
        }

        await prisma.webhookEvent.update({
            where: { id: webhookEventId },
            data: { processedAt: new Date() },
        });

        return { duplicate: false as const };
    },

    async createPaymentIntent(
        orderId: string,
        userId: string,
    ): Promise<PaymentIntentResponse> {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                payments: {
                    orderBy: { createdAt: "asc" },
                },
            },
        });

        if (!order) {
            throw AppError.notFound("NOT_FOUND", "Order not found");
        }
        if (order.userId !== userId) {
            throw AppError.forbidden();
        }
        if (order.status !== OrderStatus.PENDING) {
            throw AppError.conflict(
                "INVALID_STATUS",
                `Cannot create payment for order in status '${order.status}'`,
            );
        }

        // The Payment row is created inside the order create transaction.
        // Use the first (and typically only) payment record.
        const payment = order.payments[0];
        if (!payment) {
            throw AppError.internal(
                "NO_PAYMENT_RECORD",
                "Order has no associated payment record",
            );
        }

        // If a PaymentIntent was already created and is still usable,
        // return it so the frontend can replay the cached idempotency
        // response. Terminal PaymentIntents cannot initialize Elements,
        // so fall through to create a new one.
        if (payment.providerPaymentId) {
            const stripe = getStripe();
            const intent = await stripe.paymentIntents.retrieve(
                payment.providerPaymentId,
            );
            if (intent.status !== "succeeded" && intent.status !== "canceled") {
                const dto = await ordersService.getById(userId, false, orderId);
                return {
                    clientSecret: intent.client_secret!,
                    order: dto,
                };
            }
        }

        const stripe = getStripe();
        const intent = await stripe.paymentIntents.create({
            amount: Number(order.totalMinor),
            currency: order.currency.toLowerCase(),
            automatic_payment_methods: { enabled: true },
            metadata: { userId, orderId },
        });

        // Link the PaymentIntent to the Payment row.
        await prisma.payment.update({
            where: { id: payment.id },
            data: { providerPaymentId: intent.id },
        });

        const dto = await ordersService.getById(userId, false, orderId);
        return {
            clientSecret: intent.client_secret!,
            order: dto,
        };
    },
};
