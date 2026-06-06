import { prisma } from "@repo/db";
import { OrderStatus, PaymentStatus } from "@repo/shared";
import { getStripe } from "../lib/stripe";
import { logger } from "../lib/logger";
import { restoreInventory } from "@repo/db";

const ABANDONED_THRESHOLD_MINUTES = 30;

/**
 * Sweeps PENDING orders that have been abandoned (no payment received within
 * the threshold). Cancels the Stripe PaymentIntent and restores inventory.
 */
async function sweepAbandonedOrders(): Promise<number> {
    const threshold = new Date(
        Date.now() - ABANDONED_THRESHOLD_MINUTES * 60 * 1000,
    );

    // Find PENDING orders created before the threshold.
    const abandonedOrders = await prisma.order.findMany({
        where: {
            status: OrderStatus.PENDING,
            createdAt: { lt: threshold },
        },
        include: {
            items: true,
            payments: {
                where: {
                    providerPaymentId: { not: null },
                    status: PaymentStatus.REQUIRES_PAYMENT,
                },
                take: 1,
            },
        },
    });

    if (abandonedOrders.length === 0) {
        return 0;
    }

    const stripe = getStripe();
    let processedCount = 0;

    for (const order of abandonedOrders) {
        try {
            await prisma.$transaction(async (tx) => {
                // Double-check status still PENDING (another process may have resolved it).
                const current = await tx.order.findUnique({
                    where: { id: order.id },
                    select: { status: true },
                });
                if (!current || current.status !== OrderStatus.PENDING) {
                    return;
                }

                // Cancel Stripe PaymentIntent best-effort.
                const payment = order.payments[0];
                if (payment?.providerPaymentId) {
                    await stripe.paymentIntents
                        .cancel(payment.providerPaymentId)
                        .catch((e: unknown) => {
                            logger.error(
                                `stripe cancel failed for ${payment.providerPaymentId}`,
                                e,
                            );
                        });
                }

                // Transition to CANCELLED.
                await tx.order.update({
                    where: { id: order.id },
                    data: { status: OrderStatus.CANCELLED },
                });

                await restoreInventory(tx, order.items);

                // Mark payment as failed.
                if (payment) {
                    await tx.payment.update({
                        where: { id: payment.id },
                        data: {
                            status: PaymentStatus.FAILED,
                            failureReason: "Abandoned order — payment not received",
                        },
                    });
                }
            });

            processedCount++;
            logger.info(`Swept abandoned order: ${order.id}`);
        } catch (err) {
            logger.error(`Failed to sweep order ${order.id}:`, err);
        }
    }

    return processedCount;
}

// Run directly when invoked via ts-node/script runner.
if (require.main === module) {
    sweepAbandonedOrders()
        .then((count) => {
            logger.info(`Swept ${count} abandoned orders`);
            process.exit(0);
        })
        .catch((err) => {
            logger.error("Sweeper failed:", err);
            process.exit(1);
        });
}