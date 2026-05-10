import { Router } from "express";
import express from "express";
import { stripeWebhook } from "./payments.controller";

export const paymentsRouter: Router = Router();

// Webhook MUST receive the raw request body for Stripe signature verification.
// `express.json()` is mounted globally in app.ts; we use a router-local raw
// parser here that runs before the global JSON parser sees this path.
paymentsRouter.post(
    "/webhook",
    express.raw({ type: "application/json" }),
    stripeWebhook,
);
