"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, X } from "lucide-react";
import { Elements } from "@stripe/react-stripe-js";
import { type AddressDTO } from "@repo/shared";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PayForm } from "@/components/payment/PayForm";
import { useIdempotencyKey } from "@/hooks/useIdempotencyKey";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import { usePromoCode } from "@/hooks/usePromoCode";
import OrderSummaryBreakdown from "@/components/OrderSummaryBreakdown";
import OrderItemRow from "@/components/OrderItemRow";

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
    discountMinor: string;
    discountNote?: string;
    initialPromoCode?: string;
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
        discountMinor,
        discountNote,
        initialPromoCode,
    } = props;

    const [selectedAddressId, setSelectedAddressId] = useState(
        addresses[0]?.id ?? "",
    );
    const [localDiscountMinor, setLocalDiscountMinor] = useState(discountMinor);
    const [localDiscountNote, setLocalDiscountNote] = useState(discountNote);
    const [localTotalMinor, setLocalTotalMinor] = useState(totalMinor);
    const [localShippingMinor, setLocalShippingMinor] = useState(shippingMinor);
    const [localTaxMinor, setLocalTaxMinor] = useState(taxMinor);

    const {
        promoCode,
        promoInput,
        setPromoInput,
        applying,
        promoError,
        clearError,
        applyPromo,
    } = usePromoCode({
        initialCode: initialPromoCode,
        onSuccess: (data) => {
            setLocalDiscountMinor(data.discountMinor);
            setLocalDiscountNote(data.discountNote);
            setLocalTotalMinor(data.totalMinor);
            setLocalShippingMinor(data.shippingMinor);
            setLocalTaxMinor(data.taxMinor);
        },
    });

    const { getBaseKey, clearKey } = useIdempotencyKey({
        currency,
        totalMinor: localTotalMinor,
        selectedAddressId,
        rows,
    });

    const { stripe, creating, orderError, order, startPayment } =
        useStripeCheckout(publishableKey);

    const handleStartPayment = () => {
        startPayment(getBaseKey(), selectedAddressId, promoCode || undefined);
    };

    return (
        <div className="mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-8">
                <section>
                    <h2 className="text-lg font-semibold text-white">Order items</h2>
                    <div className="mt-4 divide-y divide-slate-700 rounded-md border border-slate-700 bg-slate-800">
                        {rows.map((row) => (
                            <OrderItemRow
                                key={row.productId}
                                productName={row.productName}
                                imageUrl={row.imageUrl}
                                quantity={row.quantity}
                                unitPriceMinor={row.unitPriceMinor}
                                lineTotalMinor={row.lineTotalMinor}
                                currency={currency}
                            />
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
                    <h2 className="text-lg font-semibold text-white">Promo code</h2>
                    <div className="mt-4 rounded-md border border-slate-700 bg-slate-800 p-5">
                        {promoCode ? (
                            <div className="flex items-center gap-2">
                                <span className="flex-1 text-sm font-medium text-emerald-300">
                                    {promoCode}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => applyPromo("")}
                                    disabled={applying}
                                    className="text-emerald-400 hover:text-emerald-200"
                                    aria-label="Remove promo code"
                                >
                                    {applying ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <X className="h-4 w-4" />
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={promoInput}
                                    onChange={(e) => {
                                        setPromoInput(e.target.value);
                                        clearError();
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            applyPromo(promoInput);
                                        }
                                    }}
                                    placeholder="Enter promo code"
                                    maxLength={30}
                                    className="flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => applyPromo(promoInput)}
                                    disabled={applying || !promoInput.trim()}
                                    className="rounded bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 disabled:opacity-50"
                                >
                                    {applying ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        "Apply"
                                    )}
                                </button>
                            </div>
                        )}
                        {promoError && (
                            <p role="alert" className="mt-2 text-xs text-red-400">{promoError}</p>
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
                                    onClick={handleStartPayment}
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
                                    totalMinor={localTotalMinor}
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
                    <OrderSummaryBreakdown
                        subtotalMinor={subtotalMinor}
                        discountMinor={localDiscountMinor}
                        shippingMinor={localShippingMinor}
                        taxMinor={localTaxMinor}
                        totalMinor={localTotalMinor}
                        currency={currency}
                        discountNote={localDiscountNote}
                        shippingNote={shippingNote}
                        taxNote={taxNote}
                    />
                </div>
            </aside>
        </div>
    );
}
