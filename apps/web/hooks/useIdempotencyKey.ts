"use client";

import { useMemo } from "react";

function generateKey(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return `order-${crypto.randomUUID()}`;
    }
    return `order-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useIdempotencyKey(deps: {
    currency: string;
    totalMinor: string;
    selectedAddressId: string;
    rows: Array<{ productId: string; quantity: number }>;
}) {
    const { currency, totalMinor, selectedAddressId, rows } = deps;

    const storageKey = useMemo(() => {
        const cartFingerprint = rows
            .map((row) => `${row.productId}:${row.quantity}`)
            .sort()
            .join("|");
        return `ecomm:checkout:idempotency:${currency}:${totalMinor}:${selectedAddressId}:${cartFingerprint}`;
    }, [currency, rows, selectedAddressId, totalMinor]);

    function getBaseKey(): string {
        const existing = window.sessionStorage.getItem(storageKey);
        if (existing) return existing;
        const key = generateKey();
        window.sessionStorage.setItem(storageKey, key);
        return key;
    }

    function clearKey(): void {
        window.sessionStorage.removeItem(storageKey);
    }

    return { getBaseKey, clearKey };
}
