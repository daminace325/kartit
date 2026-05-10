"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
    Elements,
    PaymentElement,
    useElements,
    useStripe,
} from "@stripe/react-stripe-js";
import { formatMoney } from "@repo/shared";
import { formatApiError } from "@/lib/errors";

type Row = {
    productId: string;
    productName: string;
    imageUrl: string | null;
    quantity: number;
    unitPriceMinor: string;
    lineTotalMinor: string;
};

interface Props {
    publishableKey: string;
    rows: Row[];
    subtotalMinor: string;
    shippingMinor: string;
    taxMinor: string;
    totalMinor: string;
    currency: string;
    shippingNote?: string;
    taxNote?: string;
}

let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(publishableKey: string): Promise<Stripe | null> {
    if (!stripePromise) stripePromise = loadStripe(publishableKey);
    return stripePromise;
}

function newIdempotencyKey(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return `order-${crypto.randomUUID()}`;
    }
    return `order-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getCheckoutAttemptKey(storageKey: string): string {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return existing;

    const key = newIdempotencyKey();
    window.sessionStorage.setItem(storageKey, key);
    return key;
}

export default function CheckoutClient(props: Props) {
    const {
        publishableKey,
        rows,
        subtotalMinor,
        shippingMinor,
        taxMinor,
        totalMinor,
        currency,
        shippingNote,
        taxNote,
    } = props;

    const [creating, setCreating] = useState(false);
    const [orderError, setOrderError] = useState<string | null>(null);
    const [order, setOrder] = useState<{
        id: string;
        clientSecret: string;
    } | null>(null);

    const stripe = useMemo(() => getStripe(publishableKey), [publishableKey]);
    const checkoutAttemptStorageKey = useMemo(() => {
        const cartFingerprint = rows
            .map((row) => `${row.productId}:${row.quantity}`)
            .sort()
            .join("|");
        return `ecomm:checkout:idempotency:${currency}:${totalMinor}:${cartFingerprint}`;
    }, [currency, rows, totalMinor]);

    async function startPayment() {
        setCreating(true);
        setOrderError(null);
        const idempotencyKey = getCheckoutAttemptKey(checkoutAttemptStorageKey);
        try {
            const res = await fetch("/api/orders", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Idempotency-Key": idempotencyKey,
                },
                body: JSON.stringify({}),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setOrderError(formatApiError(data?.error, "Failed to start checkout"));
                return;
            }
            if (!data?.clientSecret || !data?.order?.id) {
                setOrderError("Payment provider did not return a client secret.");
                return;
            }
            window.sessionStorage.removeItem(checkoutAttemptStorageKey);
            setOrder({ id: data.order.id, clientSecret: data.clientSecret });
        } catch {
            setOrderError("Network error. Please try again.");
        } finally {
            setCreating(false);
        }
    }

    return (
        <div className="mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-8">
                <section>
                    <h2 className="text-lg font-semibold text-white">Order items</h2>
                    <div className="mt-4 divide-y divide-slate-700 rounded-md border border-slate-700 bg-slate-800">
                        {rows.map((row) => (
                            <div key={row.productId} className="flex gap-4 p-4">
                                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-slate-900">
                                    {row.imageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={row.imageUrl}
                                            alt={row.productName}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : null}
                                </div>
                                <div className="flex flex-1 items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-medium text-white">
                                            {row.productName}
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            Qty {row.quantity} ·{" "}
                                            {formatMoney(BigInt(row.unitPriceMinor), currency)} each
                                        </div>
                                    </div>
                                    <div className="text-sm font-medium text-white">
                                        {formatMoney(BigInt(row.lineTotalMinor), currency)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-white">Payment</h2>
                    <div className="mt-4 rounded-md border border-slate-700 bg-slate-800 p-5">
                        {!order ? (
                            <>
                                <p className="text-sm text-slate-300">
                                    Click below to create your order and load the secure
                                    Stripe payment form.
                                </p>
                                {orderError && (
                                    <div className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                                        {orderError}
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={startPayment}
                                    disabled={creating}
                                    className="mt-4 inline-flex items-center justify-center gap-2 rounded-md bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-60"
                                >
                                    {creating ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Preparing...
                                        </>
                                    ) : (
                                        "Continue to payment"
                                    )}
                                </button>
                            </>
                        ) : (
                            <Elements
                                stripe={stripe}
                                options={{
                                    clientSecret: order.clientSecret,
                                    appearance: { theme: "night" },
                                }}
                            >
                                <PayForm orderId={order.id} totalMinor={totalMinor} currency={currency} />
                            </Elements>
                        )}
                    </div>
                </section>
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
                <div className="rounded-md border border-slate-700 bg-slate-800 p-6">
                    <h2 className="text-lg font-semibold text-white">Summary</h2>
                    <dl className="mt-4 space-y-2 text-sm">
                        <div className="flex justify-between text-slate-300">
                            <dt>Subtotal</dt>
                            <dd>{formatMoney(BigInt(subtotalMinor), currency)}</dd>
                        </div>
                        <div className="flex justify-between text-slate-300">
                            <dt>
                                Shipping
                                {shippingNote && (
                                    <span className="ml-2 text-xs text-slate-500">
                                        {shippingNote}
                                    </span>
                                )}
                            </dt>
                            <dd>
                                {BigInt(shippingMinor) === 0n
                                    ? "Free"
                                    : formatMoney(BigInt(shippingMinor), currency)}
                            </dd>
                        </div>
                        <div className="flex justify-between text-slate-300">
                            <dt>
                                Tax
                                {taxNote && (
                                    <span className="ml-2 text-xs text-slate-500">{taxNote}</span>
                                )}
                            </dt>
                            <dd>
                                {BigInt(taxMinor) === 0n
                                    ? "—"
                                    : formatMoney(BigInt(taxMinor), currency)}
                            </dd>
                        </div>
                        <div className="my-3 h-px bg-slate-700" />
                        <div className="flex justify-between text-base font-semibold text-white">
                            <dt>Total</dt>
                            <dd>{formatMoney(BigInt(totalMinor), currency)}</dd>
                        </div>
                    </dl>
                </div>
            </aside>
        </div>
    );
}

function PayForm({
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

    // After confirmPayment we briefly land back here; the webhook will mark
    // the order PAID. Redirect into the order detail page.
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
        // On success the browser is redirected to return_url; nothing else to do.
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
