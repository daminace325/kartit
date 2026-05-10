import Stripe from "stripe";
import { env } from "../config/env";
import { AppError } from "./errors";

let client: Stripe | null = null;

export function getStripe(): Stripe {
    if (!env.STRIPE_SECRET_KEY) {
        throw AppError.internal(
            "STRIPE_NOT_CONFIGURED",
            "Stripe is not configured (STRIPE_SECRET_KEY missing)",
        );
    }
    if (!client) {
        client = new Stripe(env.STRIPE_SECRET_KEY, {
            // Pin SDK behavior to a known API version. SDK type uses the
            // version string baked into the installed package.
            apiVersion: "2025-08-27.basil",
            typescript: true,
        });
    }
    return client;
}
