"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { formatMoney } from "@repo/shared";
import { ErrorBanner } from "@/components/ErrorBanner";

export function PayForm({
    orderId,
    totalMinor,
    currency,
    clearIdempotencyKey,
}: {
    orderId: string;
    totalMinor: string;
    currency: string;
    clearIdempotencyKey: () => void;
}) {
    const stripe = useStripe();
    const elements = useElements();
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!stripe) return;
        const url = new URL(window.location.href);
        const intentSecret =
            url.searchParams.get("payment_intent_client_secret") ?? null;
        if (!intentSecret) return;
        stripe
            .retrievePaymentIntent(intentSecret)
            .then(({ paymentIntent }) => {
                if (paymentIntent?.status === "succeeded") {
                    router.replace(`/orders/${orderId}`);
                }
            })
            .catch(() => undefined);
    }, [stripe, orderId, router]);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!stripe || !elements) return;
        setSubmitting(true);
        setError(null);

        // Once the user submits payment we no longer need the idempotency
        // key for this checkout attempt. Clearing it here means a subsequent
        // checkout visit always generates a fresh key, avoiding stale
        // idempotency replays that would return a terminal PaymentIntent.
        clearIdempotencyKey();

        const { error: stripeError } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: `${window.location.origin}/orders/${orderId}`,
            },
        });

        if (stripeError) {
            setError(stripeError.message ?? "Payment failed");
            setSubmitting(false);
        }
    }

    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <PaymentElement />
            <ErrorBanner message={error} className="rounded-md text-red-200" />
            <button
                type="submit"
                disabled={!stripe || !elements || submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {submitting ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                    </>
                ) : (
                    `Pay ${formatMoney(totalMinor, currency)}`
                )}
            </button>
            <p className="text-center text-xs text-slate-500">
                Test card: 4242 4242 4242 4242 · any future date · any CVC
            </p>
        </form>
    );
}
