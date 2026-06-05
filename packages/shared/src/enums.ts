// Mirror of Prisma enums as plain string unions so the web app
// doesn't need to import the Prisma client.

export const UserRole = {
    CUSTOMER: "CUSTOMER",
    ADMIN: "ADMIN",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const OrderStatus = {
    PENDING: "PENDING",
    PAID: "PAID",
    PROCESSING: "PROCESSING",
    SHIPPED: "SHIPPED",
    DELIVERED: "DELIVERED",
    CANCELLED: "CANCELLED",
    FAILED: "FAILED",
    REFUNDED: "REFUNDED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PaymentStatus = {
    REQUIRES_PAYMENT: "REQUIRES_PAYMENT",
    SUCCEEDED: "SUCCEEDED",
    FAILED: "FAILED",
    REFUNDED: "REFUNDED",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

// ── Inventory lifecycle constants ─────────────────────────────────

/**
 * Statuses for which inventory is held (reservedQty has been incremented).
 * Transitioning from one of these into a release status restores stock.
 */
export const STOCK_HELD: ReadonlySet<OrderStatus> = new Set([
    OrderStatus.PENDING,
    OrderStatus.PAID,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
]);

/**
 * Statuses that release held inventory — either by moving reservedQty
 * back to available, or by incrementing physicalStock for returns.
 */
export const STOCK_RELEASE: ReadonlySet<OrderStatus> = new Set([
    OrderStatus.CANCELLED,
    OrderStatus.FAILED,
    OrderStatus.REFUNDED,
]);
