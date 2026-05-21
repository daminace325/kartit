// Single source of truth for API error codes.
// API throws these, web reads `error.code` to switch behavior.

export const ErrorCode = {
    // Generic
    VALIDATION_FAILED: "VALIDATION_FAILED",
    NOT_FOUND: "NOT_FOUND",
    INTERNAL: "INTERNAL",

    // Auth
    UNAUTHORIZED: "UNAUTHORIZED",
    FORBIDDEN: "FORBIDDEN",
    EMAIL_IN_USE: "EMAIL_IN_USE",
    INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
    SESSION_INVALID: "SESSION_INVALID",

    // Catalog / cart
    PRODUCT_INACTIVE: "PRODUCT_INACTIVE",
    INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",

    // Orders / payments
    CART_EMPTY: "CART_EMPTY",
    ORDER_INVALID_STATE: "ORDER_INVALID_STATE",
    PAYMENT_FAILED: "PAYMENT_FAILED",

    // Idempotency (P1.1)
    IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
    IDEMPOTENCY_IN_PROGRESS: "IDEMPOTENCY_IN_PROGRESS",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
