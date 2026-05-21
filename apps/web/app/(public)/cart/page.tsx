import Link from "next/link";
import { redirect } from "next/navigation";
import { ShoppingCart, AlertTriangle } from "lucide-react";
import { api } from "@/lib/apiClient";
import { getCurrentUser } from "@/lib/auth";
import { formatMoney, type CartDTO } from "@repo/shared";
import CartItemControls from "@/components/CartItemControls";
import ClearCartButton from "@/components/ClearCartButton";

export const dynamic = "force-dynamic";

export default async function CartPage() {
    const user = await getCurrentUser();
    if (!user) redirect("/signin?next=/cart");

    const { cart } = await api.get<{ cart: CartDTO }>("/cart");
    const items = cart.items;

    if (items.length === 0) {
        return (
            <div className="mx-auto max-w-3xl">
                <div className="flex flex-col items-center rounded-md border border-slate-700 bg-slate-800 p-10 text-center">
                    <ShoppingCart className="h-12 w-12 text-slate-500" />
                    <h1 className="mt-4 text-2xl font-semibold text-white">
                        Your cart is empty
                    </h1>
                    <p className="mt-2 text-sm text-slate-400">
                        Browse the store and add items to get started.
                    </p>
                    <Link
                        href="/"
                        className="mt-6 rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400"
                    >
                        Continue shopping
                    </Link>
                </div>
            </div>
        );
    }

    const totalQty = items.reduce((n, i) => n + i.quantity, 0);

    return (
        <div>
            <div className="mb-6 flex items-center justify-between">
                <h1 className="text-3xl font-semibold text-white">Your Cart</h1>
                <ClearCartButton />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
                <div className="space-y-3">
                    {items.map((item) => {
                        const overStock = item.quantity > item.stock;
                        return (
                            <div
                                key={item.id}
                                className="flex flex-col gap-4 rounded-md border border-slate-700 bg-slate-800 p-4 sm:flex-row"
                            >
                                <Link
                                    href={`/p/${item.productSlug}`}
                                    className="h-24 w-24 shrink-0 overflow-hidden rounded bg-slate-900"
                                >
                                    {item.imageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={item.imageUrl}
                                            alt={item.productName}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                                            No image
                                        </div>
                                    )}
                                </Link>

                                <div className="flex flex-1 flex-col gap-2">
                                    <Link
                                        href={`/p/${item.productSlug}`}
                                        className="font-medium text-white hover:text-sky-400"
                                    >
                                        {item.productName}
                                    </Link>
                                    <p className="text-sm text-slate-400">
                                        {formatMoney(BigInt(item.unitPriceMinor), item.currency)}{" "}
                                        each
                                    </p>
                                    {!item.isActive && (
                                        <p className="inline-flex items-center gap-1 text-xs text-red-300">
                                            <AlertTriangle className="h-3.5 w-3.5" />
                                            This product is no longer available.
                                        </p>
                                    )}
                                    {item.isActive && overStock && (
                                        <p className="inline-flex items-center gap-1 text-xs text-amber-300">
                                            <AlertTriangle className="h-3.5 w-3.5" />
                                            Only {item.stock} in stock — please reduce quantity.
                                        </p>
                                    )}
                                    {item.isActive && item.stock === 0 && (
                                        <p className="inline-flex items-center gap-1 text-xs text-red-300">
                                            <AlertTriangle className="h-3.5 w-3.5" />
                                            Out of stock
                                        </p>
                                    )}
                                </div>

                                <div className="flex flex-col items-end justify-between gap-3">
                                    <p className="text-base font-semibold text-white">
                                        {formatMoney(
                                            BigInt(item.lineTotalMinor),
                                            item.currency,
                                        )}
                                    </p>
                                    <CartItemControls
                                        productId={item.productId}
                                        qty={item.quantity}
                                        stock={item.stock}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                <aside className="h-fit rounded-md border border-slate-700 bg-slate-800 p-5">
                    <h2 className="text-lg font-semibold text-white">Order summary</h2>
                    <dl className="mt-4 space-y-2 text-sm">
                        <div className="flex justify-between text-slate-300">
                            <dt>
                                Subtotal ({totalQty} item{totalQty === 1 ? "" : "s"})
                            </dt>
                            <dd>
                                {formatMoney(BigInt(cart.subtotalMinor), cart.currency)}
                            </dd>
                        </div>
                        <div className="flex justify-between text-slate-300">
                            <dt>Shipping &amp; tax</dt>
                            <dd className="text-slate-400">Calculated at checkout</dd>
                        </div>
                        <div className="flex justify-between border-t border-slate-700 pt-3 text-base font-semibold text-white">
                            <dt>Total</dt>
                            <dd>
                                {formatMoney(BigInt(cart.subtotalMinor), cart.currency)}
                            </dd>
                        </div>
                    </dl>

                    <Link
                        href="/checkout"
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
            </div>
        </div>
    );
}
