import { csrfFetch } from "@/lib/csrf";

export async function createOrder(
    idempotencyKey: string,
    shippingAddressId: string,
) {
    const res = await csrfFetch("/api/orders", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ shippingAddressId }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
}

export async function createPaymentIntent(
    idempotencyKey: string,
    orderId: string,
) {
    const res = await csrfFetch("/api/payments/intent", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ orderId }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
}
