import { formatMoney } from "@repo/shared";

type Props = {
    subtotalMinor: string;
    discountMinor: string;
    shippingMinor: string;
    taxMinor: string;
    totalMinor: string;
    currency: string;
    /** Override the default "Subtotal" label (e.g. "Subtotal (3 items)"). */
    subtotalLabel?: string;
    /** Shown in parentheses next to the Discount line when discount > 0. */
    discountNote?: string;
    /** Shown in parentheses next to Shipping. */
    shippingNote?: string;
    /** Shown in parentheses next to Tax. */
    taxNote?: string;
};

export default function OrderSummaryBreakdown({
    subtotalMinor,
    discountMinor,
    shippingMinor,
    taxMinor,
    totalMinor,
    currency,
    subtotalLabel = "Subtotal",
    discountNote,
    shippingNote,
    taxNote,
}: Props) {
    const hasDiscount = BigInt(discountMinor) > 0n;
    const isFreeShipping = BigInt(shippingMinor) === 0n;
    const isTaxZero = BigInt(taxMinor) === 0n;

    return (
        <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between text-slate-300">
                <dt>{subtotalLabel}</dt>
                <dd>{formatMoney(subtotalMinor, currency)}</dd>
            </div>

            {hasDiscount && (
                <div className="flex justify-between text-emerald-400">
                    <dt>
                        Discount
                        {discountNote && (
                            <span className="ml-1 text-xs text-emerald-500">
                                ({discountNote})
                            </span>
                        )}
                    </dt>
                    <dd>-{formatMoney(discountMinor, currency)}</dd>
                </div>
            )}

            <div className="flex justify-between text-slate-300">
                <dt>
                    Shipping
                    {shippingNote && (
                        <span className="ml-2 text-xs text-slate-500">
                            ({shippingNote})
                        </span>
                    )}
                </dt>
                <dd>
                    {isFreeShipping
                        ? "Free"
                        : formatMoney(shippingMinor, currency)}
                </dd>
            </div>

            <div className="flex justify-between text-slate-300">
                <dt>
                    Tax
                    {taxNote && (
                        <span className="ml-2 text-xs text-slate-500">
                            ({taxNote})
                        </span>
                    )}
                </dt>
                <dd>
                    {isTaxZero ? "—" : formatMoney(taxMinor, currency)}
                </dd>
            </div>

            <div className="my-3 h-px bg-slate-700" />

            <div className="flex justify-between text-base font-semibold text-white">
                <dt>Total</dt>
                <dd>{formatMoney(totalMinor, currency)}</dd>
            </div>
        </dl>
    );
}
