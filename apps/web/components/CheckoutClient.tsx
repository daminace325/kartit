"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Elements } from "@stripe/react-stripe-js";
import { formatMoney, type AddressDTO } from "@repo/shared";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PayForm } from "@/components/payment/PayForm";
import { useIdempotencyKey } from "@/hooks/useIdempotencyKey";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";

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
    addresses: AddressDTO[];
    shippingNote?: string;
    taxNote?: string;
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
        addresses,
        shippingNote,
        taxNote,
    } = props;

    const [selectedAddressId, setSelectedAddressId] = useState(
        addresses[0]?.id ?? "",
    );

    const { getBaseKey, clearKey } = useIdempotencyKey({
        currency,
        totalMinor,
        selectedAddressId,
        rows,
    });

    const { stripe, creating, orderError, order, startPayment } =
        useStripeCheckout(publishableKey);

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
                                            {formatMoney(row.unitPriceMinor, currency)} each
                                        </div>
                                    </div>
                                    <div className="text-sm font-medium text-white">
                                        {formatMoney(row.lineTotalMinor, currency)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-white">Shipping address</h2>
                    <div className="mt-4 rounded-md border border-slate-700 bg-slate-800 p-5">
                        {addresses.length === 0 ? (
                            <div>
                                <p className="text-sm text-slate-300">
                                    Add a delivery address before starting payment.
                                </p>
                                <Link
                                    href="/profile/addresses"
                                    className="mt-4 inline-flex items-center rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400"
                                >
                                    Add address
                                </Link>
                            </div>
                        ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
                                {addresses.map((addr) => {
                                    const selected = addr.id === selectedAddressId;
                                    return (
                                        <label
                                            key={addr.id}
                                            className={`block cursor-pointer rounded-md border p-4 text-sm transition ${
                                                selected
                                                    ? "border-sky-400 bg-sky-500/10"
                                                    : "border-slate-700 bg-slate-900 hover:border-slate-500"
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="shippingAddressId"
                                                value={addr.id}
                                                checked={selected}
                                                onChange={() => {
                                                    setSelectedAddressId(addr.id);
                                                }}
                                                className="sr-only"
                                            />
                                            <span className="block font-medium text-white">
                                                {addr.name}
                                            </span>
                                            <span className="mt-1 block text-slate-400">
                                                {addr.phone}
                                            </span>
                                            <span className="mt-3 block text-slate-300">
                                                {addr.line1}
                                                {addr.line2 ? `, ${addr.line2}` : ""}
                                            </span>
                                            <span className="block text-slate-400">
                                                {addr.city}
                                                {addr.state ? `, ${addr.state}` : ""}{" "}
                                                {addr.postalCode}
                                            </span>
                                            {addr.country && (
                                                <span className="block text-slate-400">
                                                    {addr.country}
                                                </span>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                        )}
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
                                {orderError && <ErrorBanner message={orderError} className="mt-3 rounded-md text-red-200" />}
                                <button
                                    type="button"
                                    onClick={() => startPayment(getBaseKey(), selectedAddressId)}
                                    disabled={creating || !selectedAddressId}
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
                                <PayForm
                                    orderId={order.id}
                                    totalMinor={totalMinor}
                                    currency={currency}
                                    clearIdempotencyKey={clearKey}
                                />
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
                            <dd>{formatMoney(subtotalMinor, currency)}</dd>
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
                                    : formatMoney(shippingMinor, currency)}
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
                                    : formatMoney(taxMinor, currency)}
                            </dd>
                        </div>
                        <div className="my-3 h-px bg-slate-700" />
                        <div className="flex justify-between text-base font-semibold text-white">
                            <dt>Total</dt>
                            <dd>{formatMoney(totalMinor, currency)}</dd>
                        </div>
                    </dl>
                </div>
            </aside>
        </div>
    );
}
