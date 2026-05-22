import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { api, ApiClientError } from "@/lib/apiClient";
import { authRequired } from "@/lib/auth";
import type { AddressDTO, CartDTO, CartSummaryDTO } from "@repo/shared";
import CheckoutClient from "@/components/CheckoutClient";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
    await authRequired("/checkout");

    const publishableKey =
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

    // Verify the cart still has items, then fetch live pricing.
    const { cart } = await api.get<{ cart: CartDTO }>("/cart");
    if (cart.items.length === 0) redirect("/cart");
    const { addresses } = await api.get<{ addresses: AddressDTO[] }>(
        "/auth/me/addresses",
    );

    let summary: CartSummaryDTO;
    try {
        summary = await api.post<CartSummaryDTO>("/cart/summary");
    } catch (err) {
        // 409 INSUFFICIENT_STOCK / PRODUCT_INACTIVE → bounce back to cart with banner.
        if (err instanceof ApiClientError && err.status === 409) {
            return (
                <div className="mx-auto max-w-3xl">
                    <div className="rounded-md border border-red-500/40 bg-red-500/10 p-6">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-300" />
                            <div className="flex-1">
                                <h2 className="font-medium text-red-100">
                                    Some items in your cart need attention
                                </h2>
                                <p className="mt-1 text-sm text-red-200/80">
                                    {err.message}
                                </p>
                                <Link
                                    href="/cart"
                                    className="mt-4 inline-flex items-center rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-400"
                                >
                                    Back to cart
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
        throw err;
    }

    if (!publishableKey) {
        return (
            <div className="mx-auto max-w-3xl rounded-md border border-amber-500/40 bg-amber-500/10 p-6 text-amber-100">
                <h1 className="text-lg font-semibold">Stripe not configured</h1>
                <p className="mt-1 text-sm text-amber-200/80">
                    Set <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> in{" "}
                    <code>apps/web/.env.local</code> to enable checkout.
                </p>
            </div>
        );
    }

    const rows = summary.items.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        imageUrl: i.imageUrl,
        quantity: i.quantity,
        unitPriceMinor: i.unitPriceMinor,
        lineTotalMinor: i.lineTotalMinor,
    }));

    return (
        <div>
            <h1 className="text-3xl font-semibold text-white">Checkout</h1>
            <p className="mt-1 text-sm text-slate-400">
                Review your order and pay securely with Stripe.
            </p>

            <CheckoutClient
                publishableKey={publishableKey}
                rows={rows}
                subtotalMinor={summary.subtotalMinor}
                shippingMinor={summary.shippingMinor}
                taxMinor={summary.taxMinor}
                totalMinor={summary.totalMinor}
                currency={summary.currency}
                addresses={addresses}
                shippingNote={summary.shippingNote}
                taxNote={summary.taxNote}
            />
        </div>
    );
}
