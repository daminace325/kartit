import Link from "next/link";
import { formatMoney } from "@repo/shared";

type Props = {
    productName: string;
    /** If provided, the product name becomes a link to /p/[slug]. */
    productSlug?: string;
    /** If provided and showProductId is true, renders the ID below the qty/price line (admin only). */
    productId?: string;
    imageUrl: string | null;
    quantity: number;
    unitPriceMinor: string;
    lineTotalMinor: string;
    currency: string;
    /** When true, renders the product ID in a monospace line below qty × price. Defaults false. */
    showProductId?: boolean;
};

export default function OrderItemRow({
    productName,
    productSlug,
    productId,
    imageUrl,
    quantity,
    unitPriceMinor,
    lineTotalMinor,
    currency,
    showProductId = false,
}: Props) {
    return (
        <div className="flex gap-4 p-4">
            {imageUrl && (
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-slate-700">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={imageUrl}
                        alt={productName}
                        className="h-full w-full object-cover"
                    />
                </div>
            )}

            <div className="flex flex-1 items-center justify-between gap-4">
                <div className="min-w-0">
                    {productSlug ? (
                        <Link
                            href={`/p/${encodeURIComponent(productSlug)}`}
                            className="truncate text-sm font-medium text-white hover:text-sky-400"
                        >
                            {productName}
                        </Link>
                    ) : (
                        <span className="truncate text-sm font-medium text-white">
                            {productName}
                        </span>
                    )}
                    <div className="text-xs text-slate-400">
                        Qty {quantity} · {formatMoney(unitPriceMinor, currency)} each
                    </div>
                    {showProductId && productId && (
                        <div className="mt-0.5 font-mono text-[10px] text-slate-600">
                            {productId}
                        </div>
                    )}
                </div>
                <div className="text-sm font-medium text-white">
                    {formatMoney(lineTotalMinor, currency)}
                </div>
            </div>
        </div>
    );
}
