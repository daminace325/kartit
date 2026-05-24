import type { OrderStatus } from "./enums";

export const VALID_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
    PENDING: ["PAID", "CANCELLED", "FAILED"],
    PAID: ["PROCESSING"],
    PROCESSING: ["SHIPPED"],
    SHIPPED: ["DELIVERED"],
    DELIVERED: [],
    CANCELLED: [],
    FAILED: [],
    REFUNDED: [],
};

export function getNextStatuses(current: OrderStatus): readonly OrderStatus[] {
    return VALID_STATUS_TRANSITIONS[current];
}
