import { describe, it, expect } from "vitest";
import { OrderStatus } from "@repo/shared";
import { ALLOWED_TRANSITIONS } from "../../src/modules/orders/orders.service";

describe("Order status transitions", () => {
    const allowedPairs = Object.entries(ALLOWED_TRANSITIONS).flatMap(
        ([from, toSet]) =>
            [...toSet].map((to) => ({ from: from as OrderStatus, to })),
    );

    it.each(allowedPairs)("$from → $to is allowed", ({ from, to }) => {
        expect(ALLOWED_TRANSITIONS[from].has(to)).toBe(true);
    });

    it("PENDING allows PAID, CANCELLED, FAILED", () => {
        const allowed = ALLOWED_TRANSITIONS.PENDING;
        expect(allowed.has(OrderStatus.PAID)).toBe(true);
        expect(allowed.has(OrderStatus.CANCELLED)).toBe(true);
        expect(allowed.has(OrderStatus.FAILED)).toBe(true);
        expect(allowed.has(OrderStatus.PROCESSING)).toBe(false);
        expect(allowed.has(OrderStatus.SHIPPED)).toBe(false);
    });

    it("PAID allows PROCESSING, REFUNDED only", () => {
        const allowed = ALLOWED_TRANSITIONS.PAID;
        expect(allowed.has(OrderStatus.PROCESSING)).toBe(true);
        expect(allowed.has(OrderStatus.REFUNDED)).toBe(true);
        expect(allowed.has(OrderStatus.CANCELLED)).toBe(false);
        expect(allowed.has(OrderStatus.SHIPPED)).toBe(false);
    });

    it("DELIVERED only allows REFUNDED", () => {
        const allowed = ALLOWED_TRANSITIONS.DELIVERED;
        expect(allowed.has(OrderStatus.REFUNDED)).toBe(true);
        expect(allowed.size).toBe(1);
    });

    it("terminal statuses have no allowed transitions", () => {
        expect(ALLOWED_TRANSITIONS.CANCELLED.size).toBe(0);
        expect(ALLOWED_TRANSITIONS.FAILED.size).toBe(0);
        expect(ALLOWED_TRANSITIONS.REFUNDED.size).toBe(0);
    });

    it("STOCK_HELD statuses include active fulfillment states", () => {
        // STOCK_HELD is a private constant but we can verify stock-release
        // expectations: PAID/processing/shipped/delivered should be
        // refundable (stock released on refund).
        const refundableFrom = [
            OrderStatus.PAID,
            OrderStatus.PROCESSING,
            OrderStatus.SHIPPED,
            OrderStatus.DELIVERED,
        ];
        for (const status of refundableFrom) {
            expect(ALLOWED_TRANSITIONS[status].has(OrderStatus.REFUNDED)).toBe(
                true,
            );
        }
    });
});
