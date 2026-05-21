import { api } from "@/lib/apiClient";

export async function createOrder(
    idempotencyKey: string,
    shippingAddressId: string,
) {
    return api.post<{ order: { id: string } }>("/api/orders", {
        shippingAddressId,
    }, {
        headers: { "Idempotency-Key": idempotencyKey },
    });
}

export async function createPaymentIntent(
    idempotencyKey: string,
    orderId: string,
) {
    return api.post<{ clientSecret: string }>("/api/payments/intent", {
        orderId,
    }, {
        headers: { "Idempotency-Key": idempotencyKey },
    });
}
