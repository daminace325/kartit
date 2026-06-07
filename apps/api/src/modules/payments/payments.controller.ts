import type { PaymentIntentInput } from "@repo/shared";
import { AppError } from "../../lib/errors";
import { paymentsService } from "./payments.service";
import { asyncHandler } from "../../lib/asyncHandler";

/**
 * Stripe webhook receiver. Mounted with `express.raw({ type: "application/json" })`
 * in routes.ts so `req.body` is the exact bytes Stripe signed. Request validation
 * (headers, body type) stays in the controller; all business logic lives in
 * paymentsService.processWebhook.
 */
export const stripeWebhook = asyncHandler(async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature || Array.isArray(signature)) {
        throw AppError.badRequest(
            "INVALID_SIGNATURE",
            "Missing Stripe signature header",
        );
    }
    if (!Buffer.isBuffer(req.body)) {
        throw AppError.badRequest(
            "INVALID_BODY",
            "Webhook body must be raw bytes",
        );
    }

    const result = await paymentsService.processWebhook(req.body, signature);
    res.json(result.duplicate
        ? { received: true, duplicate: true }
        : { received: true });
});

/**
 * Test-only webhook receiver. Accepts plain JSON with either:
 *   { paymentIntentId, type }
 *     — standard path; uses an existing Stripe PaymentIntent ID
 *   { orderId, type }
 *     — zero-Stripe path; auto-assigns a synthetic providerPaymentId
 * instead of a raw Stripe-signed body. Only available when
 * STRIPE_WEBHOOK_BYPASS=true — the service layer enforces this guard.
 *
 * Used by k6 load tests to exercise the full payment processing pipeline
 * (webhook handler, order status updates, inventory, queues, notifications)
 * without sending large volumes of webhook traffic through Stripe.
 */
export const testWebhook = asyncHandler(async (req, res) => {
    const { paymentIntentId, orderId, type } = req.body ?? {};
    const result = await paymentsService.processTestWebhook({
        paymentIntentId,
        orderId,
        type,
    });
    res.json(result.duplicate
        ? { received: true, duplicate: true }
        : { received: true });
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
