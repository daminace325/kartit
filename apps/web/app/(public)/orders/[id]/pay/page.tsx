"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
    Elements,
    PaymentElement,
    useElements,
    useStripe,
} from "@stripe/react-stripe-js";
import { formatMoney, type OrderDTO } from "@repo/shared";
import { api, ApiClientError } from "@/lib/apiClient";
import { formatApiError } from "@/lib/formatApiError";

let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(key: string): Promise<Stripe | null> {
    if (!stripePromise) stripePromise = loadStripe(key);
    return stripePromise;
}

function newIdempotencyKey(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return `intent-${crypto.randomUUID()}`;
    }
    return `intent-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function PayOrderPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: orderId } = use(params);
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

    return (
        <div className="mx-auto max-w-3xl">
            <div className="text-sm text-slate-400">
                <Link href="/orders" className="hover:text-sky-400">
                    Your orders
                </Link>
                <span className="mx-2 text-slate-600">/</span>
                <Link
                    href={`/orders/${encodeURIComponent(orderId)}`}
                    className="hover:text-sky-400"
                >
                    Order details
                </Link>
                <span className="mx-2 text-slate-600">/</span>
                <span className="text-slate-300">Pay</span>
            </div>

            <h1 className="mt-4 text-3xl font-semibold text-white">
                Complete payment
            </h1>
            <p className="mt-1 text-sm text-slate-400">
                Securely pay for your order with Stripe.
            </p>

            {!publishableKey ? (
                <div className="mt-6 rounded-md border border-amber-500/40 bg-amber-500/10 p-6 text-amber-100">
                    Stripe is not configured. Set{" "}
                    <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> in{" "}
                    <code>apps/web/.env.local</code>.
                </div>
            ) : (
                <PayForm
                    orderId={orderId}
                    publishableKey={publishableKey}
                />
            )}
        </div>
    );
}

function PayForm({
    orderId,
    publishableKey,
}: {
    orderId: string;
    publishableKey: string;
}) {
    const stripe = useMemo(() => getStripe(publishableKey), [publishableKey]);
    const [loading, setLoading] = useState(true);
    const [order, setOrder] = useState<OrderDTO | null>(null);
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        let cancelled = false;
        async function init() {
            setLoading(true);
            setError(null);
            try {
                const orderData = await api.get<{ order: OrderDTO }>(
                    `/api/orders/${encodeURIComponent(orderId)}`,
                );
                const o = orderData.order;
                if (o.status !== "PENDING") {
                    router.replace(`/orders/${encodeURIComponent(orderId)}`);
                    return;
                }
                if (cancelled) return;
                setOrder(o);

                const intentData = await api.post<{ clientSecret: string }>(
                    "/api/payments/intent",
                    { orderId },
                    {
                        headers: { "Idempotency-Key": newIdempotencyKey() },
                    },
                );
                if (cancelled) return;
                setClientSecret(intentData.clientSecret);
            } catch (err) {
                if (err instanceof ApiClientError) {
                    if (err.status === 404) {
                        setError("Order not found.");
                    } else if (err.status === 403) {
                        setError("You don't have access to this order.");
                    } else {
                        setError(
                            formatApiError(
                                { message: err.message, details: err.details },
                                "Failed to load order",
                            ),
                        );
                    }
                } else {
                    setError("Network error. Please try again.");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        init();
        return () => { cancelled = true; };
    }, [orderId, router]);

    if (loading) {
        return (
            <div className="mt-12 flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200">
                {error}
                <div className="mt-4">
                    <Link
                        href={`/orders/${encodeURIComponent(orderId)}`}
                        className="text-red-300 underline hover:text-red-100"
                    >
                        Back to order
                    </Link>
                </div>
            </div>
        );
    }

    if (!clientSecret || !order) {
        return (
            <div className="mt-6 rounded-md border border-slate-500/40 bg-slate-500/10 p-6 text-sm text-slate-300">
                Unable to initialize payment form.
            </div>
        );
    }

    return (
        <div className="mt-6">
            <div className="rounded-md border border-slate-700 bg-slate-800 p-4 text-sm text-slate-300">
                <span className="font-medium text-white">
                    {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                </span>
                {" · "}
                <span className="text-slate-400">Total:{" "}</span>
                <span className="font-semibold text-white">
                    {formatMoney(BigInt(order.totalMinor), order.currency)}
                </span>
            </div>

            <div className="mt-4 rounded-md border border-slate-700 bg-slate-800 p-6">
                <Elements
                    stripe={stripe}
                    options={{
                        clientSecret,
                        appearance: { theme: "night" },
                    }}
                >
                    <StripePayForm
                        orderId={orderId}
                        totalMinor={order.totalMinor}
                        currency={order.currency}
                    />
                </Elements>
            </div>
        </div>
    );
}

function StripePayForm({
    orderId,
    totalMinor,
    currency,
}: {
    orderId: string;
    totalMinor: string;
    currency: string;
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
                    router.replace(`/orders/${encodeURIComponent(orderId)}`);
                }
            })
            .catch(() => undefined);
    }, [stripe, orderId, router]);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!stripe || !elements) return;
        setSubmitting(true);
        setError(null);

        const { error: stripeError } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: `${window.location.origin}/orders/${encodeURIComponent(orderId)}`,
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
            {error && (
                <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {error}
                </div>
            )}
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
                    `Pay ${formatMoney(BigInt(totalMinor), currency)}`
                )}
            </button>
            <p className="text-center text-xs text-slate-500">
                Test card: 4242 4242 4242 4242 · any future date · any CVC
            </p>
        </form>
    );
}
