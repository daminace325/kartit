import { Router } from "express";
import express from "express";
import cookieParser from "cookie-parser";
import { paymentIntentSchema } from "@repo/shared";
import { validate } from "../../middlewares/validate";
import { requireAuth } from "../../middlewares/requireAuth";
import { idempotency } from "../../middlewares/idempotency";
import { createPaymentIntent, stripeWebhook } from "./payments.controller";

export const paymentsRouter: Router = Router();

// Webhook MUST receive the raw request body for Stripe signature verification.
// `express.json()` is mounted globally in app.ts; we use a router-local raw
// parser here that runs before the global JSON parser sees this path.
paymentsRouter.post(
    "/webhook",
    express.raw({ type: "application/json" }),
    stripeWebhook,
);

// POST /payments/intent — create Stripe PaymentIntent for an existing order.
// Mounted here (before the global express.json) so we supply our own JSON
// parser and cookie parser on this specific route.
paymentsRouter.post(
    "/intent",
    express.json(),
    cookieParser(),
    requireAuth,
    validate(paymentIntentSchema),
    idempotency,
    createPaymentIntent,
);
