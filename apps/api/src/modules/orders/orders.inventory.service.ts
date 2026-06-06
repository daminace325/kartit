import type { Prisma } from "@repo/db";
import { AppError } from "../../lib/errors";

// ── Re-exports from canonical shared sources ──────────────────────
export { STOCK_HELD, STOCK_RELEASE } from "@repo/shared";
export { restoreInventory, shipInventory } from "@repo/db";

// ── Reservation ───────────────────────────────────────────────────

/**
 * Reserve inventory for newly created orders. Takes `pg_advisory_xact_lock`
 * on each product (sorted by ID to prevent deadlocks), then atomically checks
 * availability and increments `reservedQty`. The lock is held until the
 * surrounding transaction commits or rolls back, guaranteeing serialized
 * access to each product's reservation slot.
 */
export async function reserveInventory(
    tx: Prisma.TransactionClient,
    items: Array<{ productId: string; quantity: number; productName: string }>,
): Promise<void> {
    // Sort by product ID to prevent deadlocks when multiple transactions
    // lock the same set of products in different order.
    const sorted = [...items].sort((a, b) =>
        a.productId.localeCompare(b.productId),
    );

    for (const it of sorted) {
        // Transaction-level advisory lock — auto-released on commit/rollback.
        // $executeRawUnsafe is used because pg_advisory_xact_lock returns void,
        // which Prisma's $queryRawUnsafe (designed for row-returning queries)
        // cannot deserialize.
        await tx.$executeRawUnsafe(
            `SELECT pg_advisory_xact_lock(hashtext($1))`,
            it.productId,
        );

        // Read under lock — no other tx can change reservedQty for this product.
        const product = await tx.product.findUniqueOrThrow({
            where: { id: it.productId, deletedAt: null },
            select: { physicalStock: true, reservedQty: true },
        });

        const available = product.physicalStock - product.reservedQty;
        if (available < it.quantity) {
            throw AppError.conflict(
                "INSUFFICIENT_STOCK",
                `Insufficient stock for "${it.productName}"`,
            );
        }

        await tx.product.update({
            where: { id: it.productId },
            data: { reservedQty: { increment: it.quantity } },
        });
    }
}
