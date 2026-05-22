"use client";

import { useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { ApiClientError } from "@/services/apiClient";
import { formatApiError } from "@/lib/formatApiError";
import { createOrder, createPaymentIntent } from "@/services/checkout";

let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(publishableKey: string): Promise<Stripe | null> {
    if (!stripePromise) stripePromise = loadStripe(publishableKey);
    return stripePromise;
}

export function useStripeCheckout(publishableKey: string) {
    const stripe = useMemo(() => getStripe(publishableKey), [publishableKey]);
    const [creating, setCreating] = useState(false);
    const [orderError, setOrderError] = useState<string | null>(null);
    const [order, setOrder] = useState<{
        id: string;
        clientSecret: string;
    } | null>(null);

    async function startPayment(
        baseKey: string,
        selectedAddressId: string,
    ) {
        if (!selectedAddressId) {
            setOrderError("Select a shipping address before continuing.");
            return;
        }
        setCreating(true);
        setOrderError(null);
        try {
            const orderData = await createOrder(
                `${baseKey}:order`,
                selectedAddressId,
            );
            const orderId = orderData.order?.id;
            if (!orderId) {
                setOrderError("Order created but no ID returned.");
                return;
            }

            const intentData = await createPaymentIntent(
                `${baseKey}:intent`,
                orderId,
            );
            if (!intentData?.clientSecret) {
                setOrderError(
                    "Payment provider did not return a client secret.",
                );
                return;
            }
            setOrder({ id: orderId, clientSecret: intentData.clientSecret });
        } catch (err) {
            if (err instanceof ApiClientError) {
                setOrderError(
                    formatApiError(
                        { message: err.message, details: err.details },
                        "Failed to create order",
                    ),
                );
            } else {
                setOrderError("Network error. Please try again.");
            }
        } finally {
            setCreating(false);
        }
    }

    return { stripe, creating, orderError, order, startPayment };
}
