import { describe, it, expect } from "vitest";
import { OrderStatus } from "@repo/shared";
import { ALLOWED_TRANSITIONS } from "../../src/modules/orders/orders.dto";

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

    it("PAID allows PROCESSING only (cancel via dedicated route)", () => {
        const allowed = ALLOWED_TRANSITIONS.PAID;
        expect(allowed.has(OrderStatus.PROCESSING)).toBe(true);
        expect(allowed.has(OrderStatus.CANCELLED)).toBe(false);
        expect(allowed.has(OrderStatus.REFUNDED)).toBe(false);
        expect(allowed.has(OrderStatus.SHIPPED)).toBe(false);
    });

    it("PROCESSING allows SHIPPED only (cancel via dedicated route)", () => {
        const allowed = ALLOWED_TRANSITIONS.PROCESSING;
        expect(allowed.has(OrderStatus.SHIPPED)).toBe(true);
        expect(allowed.has(OrderStatus.CANCELLED)).toBe(false);
        expect(allowed.has(OrderStatus.REFUNDED)).toBe(false);
    });

    it("DELIVERED is terminal (refunds via webhook only)", () => {
        const allowed = ALLOWED_TRANSITIONS.DELIVERED;
        expect(allowed.size).toBe(0);
    });

    it("terminal statuses have no allowed transitions", () => {
        expect(ALLOWED_TRANSITIONS.CANCELLED.size).toBe(0);
        expect(ALLOWED_TRANSITIONS.FAILED.size).toBe(0);
        expect(ALLOWED_TRANSITIONS.REFUNDED.size).toBe(0);
        expect(ALLOWED_TRANSITIONS.DELIVERED.size).toBe(0);
    });
});
