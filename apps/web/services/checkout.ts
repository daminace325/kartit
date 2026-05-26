import { api } from "@/services/apiClient";

export async function createOrder(
    idempotencyKey: string,
    shippingAddressId: string,
    promotionCode?: string,
) {
    const body: Record<string, string> = { shippingAddressId };
    if (promotionCode) body.promotionCode = promotionCode;

    return api.post<{ order: { id: string } }>("/orders", body, {
        headers: { "Idempotency-Key": idempotencyKey },
    });
}

export async function createPaymentIntent(
    idempotencyKey: string,
    orderId: string,
) {
    return api.post<{ clientSecret: string }>("/payments/intent", {
        orderId,
    }, {
        headers: { "Idempotency-Key": idempotencyKey },
    });
}
