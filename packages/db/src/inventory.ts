import type { Prisma } from "@prisma/client";

/**
 * Release inventory reservation (cancel / fail / refund).
 *
 * Canonical definition — both the API service layer and the webhook-retry
 * worker consume this single implementation so inventory-release behavior
 * stays consistent across all code paths.
 *
 * - If `wasShipped` is true (order was SHIPPED/DELIVERED), the items physically
 *   return to the warehouse: `physicalStock += quantity`.
 * - Otherwise the items were never shipped, so we just release the reservation:
 *   `reservedQty -= quantity`.
 */
export async function restoreInventory(
    tx: Prisma.TransactionClient,
    items: Array<{ productId: string; quantity: number }>,
    wasShipped: boolean = false,
): Promise<void> {
    for (const item of items) {
        if (wasShipped) {
            // Item physically returns — increment physical stock.
            await tx.product.update({
                where: { id: item.productId },
                data: { physicalStock: { increment: item.quantity } },
            });
        } else {
            // Never left the warehouse — just release the reservation.
            await tx.product.update({
                where: { id: item.productId },
                data: { reservedQty: { decrement: item.quantity } },
            });
        }
    }
}

/**
 * Ship items: decrement both physicalStock AND reservedQty.
 * Items physically leave the warehouse and are no longer reserved.
 */
export async function shipInventory(
    tx: Prisma.TransactionClient,
    items: Array<{ productId: string; quantity: number }>,
): Promise<void> {
    for (const item of items) {
        await tx.product.update({
            where: { id: item.productId },
            data: {
                physicalStock: { decrement: item.quantity },
                reservedQty: { decrement: item.quantity },
            },
        });
    }
}
