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
