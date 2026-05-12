"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { formatApiError } from "@/lib/errors";
import { csrfFetch } from "@/lib/csrf";

type Props = {
    productId: string;
    qty: number;
    stock: number;
};

export default function CartItemControls({ productId, qty, stock }: Props) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function updateQty(newQty: number) {
        if (newQty === qty) return;
        setBusy(true);
        setError(null);
        try {
            const res = await csrfFetch(
                `/api/cart/items/${encodeURIComponent(productId)}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ quantity: newQty }),
                },
            );
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(formatApiError(data?.error, "Failed to update"));
                return;
            }
            startTransition(() => router.refresh());
        } catch {
            setError("Network error");
        } finally {
            setBusy(false);
        }
    }

    async function remove() {
        if (!confirm("Remove this item from your cart?")) return;
        setBusy(true);
        setError(null);
        try {
            const res = await csrfFetch(
                `/api/cart/items/${encodeURIComponent(productId)}`,
                { method: "DELETE" },
            );
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(formatApiError(data?.error, "Failed to remove"));
                return;
            }
            startTransition(() => router.refresh());
        } catch {
            setError("Network error");
        } finally {
            setBusy(false);
        }
    }

    const disabled = busy || pending;

    return (
        <div className="flex flex-col items-end gap-2">
            <div className="flex items-center overflow-hidden rounded-md border border-slate-700">
                <button
                    type="button"
                    onClick={() => updateQty(qty - 1)}
                    disabled={disabled || qty <= 1}
                    className="bg-slate-900 px-3 py-1.5 text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                >
                    −
                </button>
                <span className="min-w-10 border-x border-slate-700 bg-slate-800 px-3 py-1.5 text-center text-sm text-white">
                    {disabled ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : qty}
                </span>
                <button
                    type="button"
                    onClick={() => updateQty(qty + 1)}
                    disabled={disabled || qty >= stock}
                    className="bg-slate-900 px-3 py-1.5 text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                >
                    +
                </button>
            </div>

            <button
                type="button"
                onClick={remove}
                disabled={disabled}
                className="inline-flex items-center gap-1 text-xs text-red-300 hover:text-red-200 disabled:opacity-40"
            >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
            </button>

            {error && <p className="text-xs text-red-300">{error}</p>}
        </div>
    );
}
