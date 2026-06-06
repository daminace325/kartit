import { prisma } from "@repo/db";
import { ErrorCode, OrderStatus } from "@repo/shared";
import type { OrderDTO } from "@repo/shared";
import { AppError } from "../../lib/errors";
import {
    ALLOWED_TRANSITIONS,
    ORDER_INCLUDE,
    toOrderDTO,
} from "./orders.dto";
import {
    restoreInventory,
    shipInventory,
    STOCK_HELD,
    STOCK_RELEASE,
} from "./orders.inventory.service";

export const ordersStatusService = {
    async adminUpdateStatus(
        id: string,
        next: OrderStatus,
    ): Promise<OrderDTO> {
        const updated = await prisma.$transaction(async (tx) => {
            const existing = await tx.order.findUnique({
                where: { id },
                include: ORDER_INCLUDE,
            });
            if (!existing) {
                throw AppError.notFound("NOT_FOUND", "Order not found");
            }

            const current = existing.status as OrderStatus;
            if (current === next) {
                return existing;
            }

            const allowed = ALLOWED_TRANSITIONS[current];
            if (!allowed.has(next)) {
                throw AppError.conflict(
                    ErrorCode.ORDER_INVALID_STATE,
                    `Cannot transition order from '${current}' to '${next}'`,
                );
            }

            const result = await tx.order.updateMany({
                where: { id, status: current },
                data: {
                    status: next,
                    ...(next === OrderStatus.PAID && !existing.paidAt
                        ? { paidAt: new Date() }
                        : {}),
                    ...(next === OrderStatus.DELIVERED && !existing.deliveredAt
                        ? { deliveredAt: new Date() }
                        : {}),
                },
            });
            if (result.count !== 1) {
                throw AppError.conflict(
                    ErrorCode.ORDER_INVALID_STATE,
                    "Order status changed, refresh and retry",
                );
            }

            // Ship: items physically leave the warehouse. Decrement both
            // physicalStock and reservedQty (the reservation is fulfilled).
            if (next === OrderStatus.SHIPPED) {
                await shipInventory(tx, existing.items);
            }

            // Release: transition from a stock-held state to a stock-release
            // state (cancel / fail / refund). Was the order shipped?
            if (STOCK_HELD.has(current) && STOCK_RELEASE.has(next)) {
                const wasShipped =
                    current === OrderStatus.SHIPPED ||
                    current === OrderStatus.DELIVERED;
                await restoreInventory(tx, existing.items, wasShipped);
            }

            return tx.order.findUniqueOrThrow({
                where: { id },
                include: ORDER_INCLUDE,
            });
        });

        return toOrderDTO(updated);
    },
};
