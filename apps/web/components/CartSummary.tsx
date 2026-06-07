"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, X } from "lucide-react";
import { formatMoney, type CartSummaryDTO } from "@repo/shared";
import { usePromoCode } from "@/hooks/usePromoCode";

type Props = {
    initialSummary: CartSummaryDTO;
    totalQty: number;
};

export default function CartSummary({ initialSummary, totalQty }: Props) {
    const router = useRouter();
    const [summary, setSummary] = useState<CartSummaryDTO>(initialSummary);

    const {
        promoCode,
        promoInput,
        setPromoInput,
        applying,
        promoError,
        clearError,
        applyPromo,
    } = usePromoCode({
        initialCode: summary.promotionCode ?? undefined,
        onSuccess: (data) => {
            setSummary(data);
            router.refresh();
        },
    });

    const hasPromo = !!promoCode;

    return (
        <aside className="h-fit rounded-md border border-slate-700 bg-slate-800 p-5">
            <h2 className="text-lg font-semibold text-white">Order summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between text-slate-300">
                    <dt>
                        Subtotal ({totalQty} item{totalQty === 1 ? "" : "s"})
                    </dt>
                    <dd>
                        {formatMoney(summary.subtotalMinor, summary.currency)}
                    </dd>
                </div>

                {BigInt(summary.discountMinor) > 0n && (
                    <div className="flex justify-between text-emerald-400">
                        <dt>
                            Discount
                            {summary.discountNote && (
                                <span className="ml-1 text-xs text-emerald-500">
                                    ({summary.discountNote})
                                </span>
                            )}
                        </dt>
                        <dd>
                            -{formatMoney(summary.discountMinor, summary.currency)}
                        </dd>
                    </div>
                )}

                <div className="flex justify-between text-slate-300">
                    <dt>
                        Shipping
                        {summary.shippingNote && (
                            <span className="ml-2 text-xs text-slate-500">
                                ({summary.shippingNote})
                            </span>
                        )}
                    </dt>
                    <dd>
                        {BigInt(summary.shippingMinor) === 0n
                            ? "Free"
                            : formatMoney(summary.shippingMinor, summary.currency)}
                    </dd>
                </div>
                <div className="flex justify-between text-slate-300">
                    <dt>
                        Tax
                        {summary.taxNote && (
                            <span className="ml-2 text-xs text-slate-500">
                                ({summary.taxNote})
                            </span>
                        )}
                    </dt>
                    <dd>
                        {BigInt(summary.taxMinor) === 0n
                            ? "—"
                            : formatMoney(summary.taxMinor, summary.currency)}
                    </dd>
                </div>
                <div className="my-3 h-px bg-slate-700" />
                <div className="flex justify-between text-base font-semibold text-white">
                    <dt>Total</dt>
                    <dd>
                        {formatMoney(summary.totalMinor, summary.currency)}
                    </dd>
                </div>
            </dl>

            {/* Promo code input */}
            <div className="mt-5 space-y-2">
                {hasPromo ? (
                    <div className="flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm">
                        <span className="flex-1 font-medium text-emerald-300">
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
                            placeholder="Promo code"
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
                    <p role="alert" className="text-xs text-red-400">{promoError}</p>
                )}
            </div>

            <Link
                href={`/checkout${hasPromo ? `?promo=${encodeURIComponent(promoCode)}` : ""}`}
                className="mt-5 block rounded-md bg-sky-500 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-sky-400"
            >
                Proceed to checkout
            </Link>
            <Link
                href="/"
                className="mt-2 block text-center text-sm text-slate-400 hover:text-white"
            >
                Continue shopping
            </Link>
        </aside>
    );
}
