import type { Prisma } from "@repo/db";
import { OrderStatus } from "@repo/shared";
import { AppError } from "../../lib/errors";

/**
 * Serialise promotion usage checks inside the order-creation transaction so
 * concurrent checkouts cannot oversell a limited-usage promotion. Uses the
 * same pg_advisory_xact_lock pattern as reserveInventory; the lock is
 * auto-released on commit/rollback.
 */
export async function lockPromotion(
    tx: Prisma.TransactionClient,
    promotionId: string,
    userId: string,
): Promise<void> {
    await tx.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(hashtext($1))`,
        promotionId,
    );

    const invalidStatuses: OrderStatus[] = [
        OrderStatus.CANCELLED,
        OrderStatus.FAILED,
        OrderStatus.REFUNDED,
    ];

    const promo = await tx.promotion.findUnique({
        where: { id: promotionId },
        select: { maxUses: true, maxUsesPerUser: true },
    });
    if (!promo) return; // deleted between fast-path check and transaction

    if (promo.maxUses !== null) {
        const totalCount = await tx.order.count({
            where: { promotionId, status: { notIn: invalidStatuses } },
        });
        if (totalCount >= promo.maxUses) {
            throw AppError.conflict(
                "PROMOTION_EXHAUSTED",
                "Promotion usage limit reached",
            );
        }
    }

    if (promo.maxUsesPerUser !== null) {
        const userCount = await tx.order.count({
            where: { promotionId, userId, status: { notIn: invalidStatuses } },
        });
        if (userCount >= promo.maxUsesPerUser) {
            throw AppError.conflict(
                "PROMOTION_EXHAUSTED",
                "You have already used this promotion",
            );
        }
    }
}
