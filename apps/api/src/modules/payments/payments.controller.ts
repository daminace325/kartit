import { Prisma, prisma } from "@repo/db";
import type Stripe from "stripe";
import type { PaymentIntentInput } from "@repo/shared";
import { env } from "../../config/env";
import { AppError } from "../../lib/errors";
import { getStripe } from "../../lib/stripe";
import { logger } from "../../lib/logger";
import { ordersService } from "../orders/orders.service";
import { paymentsService } from "./payments.service";
import { asyncHandler } from "../../lib/asyncHandler";

/**
 * Stripe webhook receiver. Mounted with `express.raw({ type: "application/json" })`
 * in app.ts so `req.body` is the exact bytes Stripe signed. Anything else
 * fails signature verification.
 *
 * Idempotency: insert Stripe event.id into WebhookEvent before handling.
 * Duplicates are acked immediately so Stripe retries cannot repeat side
 * effects. processedAt is written only after the handler succeeds.
 */
export const stripeWebhook = asyncHandler(async (req, res) => {
    if (!env.STRIPE_WEBHOOK_SECRET) {
        throw AppError.internal(
            "STRIPE_NOT_CONFIGURED",
            "STRIPE_WEBHOOK_SECRET is not set",
        );
    }
    const signature = req.headers["stripe-signature"];
    if (!signature || Array.isArray(signature)) {
        throw AppError.badRequest(
            "INVALID_SIGNATURE",
            "Missing Stripe signature header",
        );
    }
    // Raw-body middleware leaves req.body as a Buffer.
    if (!Buffer.isBuffer(req.body)) {
        throw AppError.badRequest(
            "INVALID_BODY",
            "Webhook body must be raw bytes",
        );
    }

    const stripe = getStripe();
    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            signature,
            env.STRIPE_WEBHOOK_SECRET,
        );
    } catch (err) {
        const msg = err instanceof Error ? err.message : "verification failed";
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
            res.json({ received: true, duplicate: true });
            return;
        }
        throw err;
    }

    switch (event.type) {
        case "payment_intent.succeeded": {
            const intent = event.data.object as Stripe.PaymentIntent;
            const order = await ordersService.markPaidByPaymentIntent(intent.id);
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
            const order = await ordersService.markFailedByPaymentIntent(
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
            // charge.payment_intent is the PaymentIntent ID
            const paymentIntentId = charge.payment_intent as string;
            const order = await ordersService.markRefundedByPaymentIntent(
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
            // Other event types acked silently.
            break;
    }

    await prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { processedAt: new Date() },
    });

    // Always 200 after successful verification + handling so Stripe
    // does not retry. Errors thrown above land in the global handler.
    res.json({ received: true });
});

export const createPaymentIntent = asyncHandler(async (req, res) => {
    const user = req.user;
    if (!user) throw AppError.unauthorized();
    const { orderId } = req.body as PaymentIntentInput;
    const result = await paymentsService.createPaymentIntent(
        orderId,
        user.id,
    );
    res.status(201).json(result);
});
