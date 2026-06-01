import Stripe from "stripe";

let client: InstanceType<typeof Stripe> | null = null;

export function getStripeWorker(): InstanceType<typeof Stripe> {
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error(
            "STRIPE_SECRET_KEY is required for reconciliation worker",
        );
    }
    if (!client) {
        client = new Stripe(process.env.STRIPE_SECRET_KEY, {
            // Pin SDK behavior to a known API version.
            apiVersion: "2026-05-27.dahlia",
            typescript: true,
        });
    }
    return client;
}
