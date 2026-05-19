import { describe, it, expect } from "vitest";
import { formatMoney, parseMoney, decimalsFor } from "@repo/shared";

describe("decimalsFor", () => {
    it("returns 2 for standard currencies", () => {
        expect(decimalsFor("USD")).toBe(2);
        expect(decimalsFor("EUR")).toBe(2);
        expect(decimalsFor("INR")).toBe(2);
    });

    it("returns 0 for zero-decimal currencies", () => {
        expect(decimalsFor("JPY")).toBe(0);
        expect(decimalsFor("KRW")).toBe(0);
        expect(decimalsFor("VND")).toBe(0);
    });

    it("is case-insensitive", () => {
        expect(decimalsFor("jpy")).toBe(0);
        expect(decimalsFor("Usd")).toBe(2);
    });
});

describe("formatMoney", () => {
    it("formats USD with cents", () => {
        expect(formatMoney(1999n, "USD")).toBe("$19.99");
        expect(formatMoney(0n, "USD")).toBe("$0.00");
        expect(formatMoney(100n, "USD")).toBe("$1.00");
    });

    it("formats zero-decimal currencies without cents", () => {
        expect(formatMoney(1999n, "JPY")).toBe("¥1,999");
        expect(formatMoney(100n, "JPY")).toBe("¥100");
    });

    it("handles number input", () => {
        expect(formatMoney(1999, "USD")).toBe("$19.99");
    });

    it("formats INR with symbol", () => {
        expect(formatMoney(49900n, "INR")).toBe("₹499.00");
    });
});

describe("parseMoney", () => {
    it("parses standard decimal input into minor units", () => {
        expect(parseMoney("19.99", "USD")).toBe(1999n);
        expect(parseMoney("0.01", "USD")).toBe(1n);
        expect(parseMoney("100", "USD")).toBe(10000n);
    });

    it("parses zero-decimal currencies", () => {
        expect(parseMoney("1999", "JPY")).toBe(1999n);
        expect(parseMoney("100", "JPY")).toBe(100n);
    });

    it("handles commas in input", () => {
        expect(parseMoney("1,234.56", "USD")).toBe(123456n);
    });

    it("handles negative values", () => {
        expect(parseMoney("-19.99", "USD")).toBe(-1999n);
    });

    it("throws on invalid input", () => {
        expect(() => parseMoney("abc", "USD")).toThrow("Invalid money string");
        expect(() => parseMoney("12.34.56", "USD")).toThrow("Invalid money string");
    });
});
