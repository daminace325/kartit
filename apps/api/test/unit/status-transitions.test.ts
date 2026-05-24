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

    it("PAID allows PROCESSING only", () => {
        const allowed = ALLOWED_TRANSITIONS.PAID;
        expect(allowed.has(OrderStatus.PROCESSING)).toBe(true);
        expect(allowed.has(OrderStatus.REFUNDED)).toBe(false);
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

    it("only DELIVERED is refundable", () => {
        // Only delivered orders can be refunded
        expect(ALLOWED_TRANSITIONS[OrderStatus.DELIVERED].has(OrderStatus.REFUNDED)).toBe(true);
        expect(ALLOWED_TRANSITIONS[OrderStatus.PAID].has(OrderStatus.REFUNDED)).toBe(false);
        expect(ALLOWED_TRANSITIONS[OrderStatus.PROCESSING].has(OrderStatus.REFUNDED)).toBe(false);
        expect(ALLOWED_TRANSITIONS[OrderStatus.SHIPPED].has(OrderStatus.REFUNDED)).toBe(false);
    });
});
