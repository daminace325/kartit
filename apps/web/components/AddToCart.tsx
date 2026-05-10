"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShoppingCart, Check } from "lucide-react";

export default function AddToCart({
    productId,
    stock,
}: {
    productId: string;
    stock: number;
}) {
    const router = useRouter();
    const [qty, setQty] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [added, setAdded] = useState(false);

    const outOfStock = stock <= 0;

    async function handleAdd() {
        setLoading(true);
        setError(null);
        setAdded(false);

        try {
            const res = await fetch("/api/cart/items", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productId, quantity: qty }),
            });

            if (res.status === 401) {
                router.push(`/signin?next=${encodeURIComponent(window.location.pathname)}`);
                return;
            }

            const data = await res.json().catch(() => null);
            if (!res.ok) {
                setError(data?.error?.message ?? "Failed to add to cart");
                return;
            }

            setAdded(true);
            router.refresh();
            setTimeout(() => setAdded(false), 2000);
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    if (outOfStock) {
        return (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                Out of stock
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-3">
                <label className="text-sm text-slate-300">Quantity</label>
                <div className="flex items-center overflow-hidden rounded-md border border-slate-700">
                    <button
                        type="button"
                        onClick={() => setQty((q) => Math.max(1, q - 1))}
                        className="bg-slate-900 px-3 py-2 text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                        disabled={qty <= 1}
                    >
                        −
                    </button>
                    <span className="min-w-10 border-x border-slate-700 bg-slate-800 px-3 py-2 text-center text-sm text-white">
                        {qty}
                    </span>
                    <button
                        type="button"
                        onClick={() => setQty((q) => Math.min(stock, q + 1))}
                        className="bg-slate-900 px-3 py-2 text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                        disabled={qty >= stock}
                    >
                        +
                    </button>
                </div>
                {stock <= 5 && (
                    <span className="text-xs font-medium text-amber-400">
                        Only {stock} left in stock
                    </span>
                )}
            </div>

            {error && (
                <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                    {error}
                </p>
            )}

            <button
                type="button"
                onClick={handleAdd}
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-sky-500 px-4 py-3 font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
                {added ? (
                    <>
                        <Check className="h-5 w-5" />
                        Added to cart
                    </>
                ) : (
                    <>
                        <ShoppingCart className="h-5 w-5" />
                        {loading ? "Adding..." : "Add to cart"}
                    </>
                )}
            </button>
        </div>
    );
}
