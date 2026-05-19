import { describe, it, expect } from "vitest";
import { calculatePricing } from "@repo/shared";

describe("calculatePricing", () => {
    it("calculates free shipping above threshold ($50+)", () => {
        const result = calculatePricing({ subtotal: 5000n, currency: "USD" });
        expect(result.subtotal).toBe(5000n);
        expect(result.shipping).toBe(0n);
        expect(result.tax).toBe(0n);
        expect(result.total).toBe(5000n);
        expect(result.shippingNote).toBe("Free shipping");
    });

    it("charges shipping below threshold", () => {
        const result = calculatePricing({ subtotal: 1999n, currency: "USD" });
        expect(result.subtotal).toBe(1999n);
        expect(result.shipping).toBe(500n); // $5.00 flat
        expect(result.tax).toBe(0n);
        expect(result.total).toBe(2499n);
        expect(result.shippingNote).toBeDefined();
    });

    it("returns zero shipping for zero subtotal", () => {
        const result = calculatePricing({ subtotal: 0n, currency: "USD" });
        expect(result.shipping).toBe(0n);
        expect(result.total).toBe(0n);
    });

    it("clamps negative subtotal to 0", () => {
        const result = calculatePricing({ subtotal: -1n, currency: "USD" });
        expect(result.subtotal).toBe(0n);
    });

    it("calculates INR with 18% GST", () => {
        const result = calculatePricing({ subtotal: 10000n, currency: "INR" });
        // 10000 * 0.18 = 1800 tax
        expect(result.tax).toBe(1800n);
        // INR 100 < 499 shipping threshold => 4900 shipping
        expect(result.shipping).toBe(4900n);
        expect(result.total).toBe(10000n + 1800n + 4900n);
        expect(result.taxNote).toBe("Incl. 18% GST");
    });

    it("defaults to USD for unknown currency", () => {
        const result = calculatePricing({ subtotal: 5000n, currency: "XYZ" });
        // Uses DEFAULT_RULE: no tax, no shipping
        expect(result.tax).toBe(0n);
        expect(result.shipping).toBe(0n);
        expect(result.currency).toBe("XYZ");
    });

    it("rounds tax to nearest minor unit", () => {
        // 999 * 0.18 = 179.82 => 180
        const result = calculatePricing({ subtotal: 999n, currency: "INR" });
        expect(result.tax).toBe(180n);
    });
});
