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
