import type { OrderStatus } from "./enums";

export const VALID_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
    PENDING: ["PAID", "CANCELLED", "FAILED"],
    PAID: ["PROCESSING", "REFUNDED"],
    PROCESSING: ["SHIPPED", "REFUNDED"],
    SHIPPED: ["DELIVERED", "REFUNDED"],
    DELIVERED: ["REFUNDED"],
    CANCELLED: [],
    FAILED: [],
    REFUNDED: [],
};

export function getNextStatuses(current: OrderStatus): readonly OrderStatus[] {
    return VALID_STATUS_TRANSITIONS[current];
}
