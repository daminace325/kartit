import { prisma } from "@repo/db";
import {
    OrderStatus,
    type PaymentIntentResponse,
} from "@repo/shared";
import { AppError } from "../../lib/errors";
import { getStripe } from "../../lib/stripe";
import { ordersService } from "../orders/orders.service";

export const paymentsService = {
    async createPaymentIntent(
        orderId: string,
        userId: string,
    ): Promise<PaymentIntentResponse> {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                payments: {
                    orderBy: { createdAt: "asc" },
                },
            },
        });

        if (!order) {
            throw AppError.notFound("NOT_FOUND", "Order not found");
        }
        if (order.userId !== userId) {
            throw AppError.forbidden();
        }
        if (order.status !== OrderStatus.PENDING) {
            throw AppError.conflict(
                "INVALID_STATUS",
                `Cannot create payment for order in status '${order.status}'`,
            );
        }

        // The Payment row is created inside the order create transaction.
        // Use the first (and typically only) payment record.
        const payment = order.payments[0];
        if (!payment) {
            throw AppError.internal(
                "NO_PAYMENT_RECORD",
                "Order has no associated payment record",
            );
        }

        // If a PaymentIntent was already created and is still usable,
        // return it so the frontend can replay the cached idempotency
        // response. Terminal PaymentIntents cannot initialize Elements,
        // so fall through to create a new one.
        if (payment.providerPaymentId) {
            const stripe = getStripe();
            const intent = await stripe.paymentIntents.retrieve(
                payment.providerPaymentId,
            );
            if (intent.status !== "succeeded" && intent.status !== "canceled") {
                const dto = await ordersService.getById(userId, false, orderId);
                return {
                    clientSecret: intent.client_secret!,
                    order: dto,
                };
            }
        }

        const stripe = getStripe();
        const intent = await stripe.paymentIntents.create({
            amount: Number(order.totalMinor),
            currency: order.currency.toLowerCase(),
            automatic_payment_methods: { enabled: true },
            metadata: { userId, orderId },
        });

        // Link the PaymentIntent to the Payment row.
        await prisma.payment.update({
            where: { id: payment.id },
            data: { providerPaymentId: intent.id },
        });

        const dto = await ordersService.getById(userId, false, orderId);
        return {
            clientSecret: intent.client_secret!,
            order: dto,
        };
    },
};
