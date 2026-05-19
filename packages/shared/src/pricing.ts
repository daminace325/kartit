// Single source of truth for tax & shipping calculation.
// Used by both /cart/summary (preview) and /orders (authoritative).
//
// All amounts are integer minor units (1999 = $19.99). See ./money.ts.

type PricingInput = {
    /** Subtotal in minor units. */
    subtotal: bigint;
    currency: string;
};

type PricingBreakdown = {
    /** All amounts are minor-unit BigInts. */
    subtotal: bigint;
    shipping: bigint;
    tax: bigint;
    total: bigint;
    currency: string;
    /** Human-readable note for UI, e.g. "Free over $50". */
    shippingNote?: string;
    /** Human-readable note for UI, e.g. "Incl. 18% GST". */
    taxNote?: string;
};

type CurrencyRule = {
    /** Flat shipping fee in minor units, charged when subtotal < freeShippingOver. */
    shippingFlat: bigint;
    /** Subtotal threshold (minor units) at which shipping becomes free. */
    freeShippingOver: bigint;
    /** Tax rate as a fraction (0.18 = 18%) — kept as number, applied with bankers-style rounding. */
    taxRate: number;
    taxLabel?: string;
    currencySymbol: string;
    /** Free-shipping threshold in major units, for human-readable notes only. */
    freeShippingOverMajor: number;
};

const RULES: Record<string, CurrencyRule> = {
    INR: {
        shippingFlat: 4900n,
        freeShippingOver: 49900n,
        freeShippingOverMajor: 499,
        taxRate: 0.18,
        taxLabel: "GST",
        currencySymbol: "₹",
    },
    USD: {
        shippingFlat: 500n,
        freeShippingOver: 5000n,
        freeShippingOverMajor: 50,
        taxRate: 0,
        currencySymbol: "$",
    },
    EUR: {
        shippingFlat: 500n,
        freeShippingOver: 5000n,
        freeShippingOverMajor: 50,
        taxRate: 0,
        currencySymbol: "€",
    },
};

const DEFAULT_RULE: CurrencyRule = {
    shippingFlat: 0n,
    freeShippingOver: 0n,
    freeShippingOverMajor: 0,
    taxRate: 0,
    currencySymbol: "",
};

/** Apply a fractional tax rate to a BigInt minor-unit amount, rounding to nearest. */
function applyRate(amountMinor: bigint, rate: number): bigint {
    if (rate <= 0) return 0n;
    // Multiply by rate * 1e6 (microunits) then divide back, rounding to nearest.
    const scaled = amountMinor * BigInt(Math.round(rate * 1_000_000));
    const half = 500_000n;
    return (scaled + half) / 1_000_000n;
}

export function calculatePricing(input: PricingInput): PricingBreakdown {
    const subtotal = input.subtotal < 0n ? 0n : input.subtotal;
    const currency = (input.currency || "USD").toUpperCase();
    const rule = RULES[currency] ?? DEFAULT_RULE;

    const freeShipping = rule.freeShippingOver > 0n && subtotal >= rule.freeShippingOver;
    const shipping = subtotal === 0n ? 0n : freeShipping ? 0n : rule.shippingFlat;
    const tax = applyRate(subtotal, rule.taxRate);
    const total = subtotal + shipping + tax;

    let shippingNote: string | undefined;
    if (subtotal === 0n) {
        shippingNote = undefined;
    } else if (freeShipping) {
        shippingNote = "Free shipping";
    } else if (rule.freeShippingOver > 0n) {
        const remainingMajor = Number(rule.freeShippingOver - subtotal) / 100;
        shippingNote = `Free over ${rule.currencySymbol}${rule.freeShippingOverMajor} · add ${rule.currencySymbol}${remainingMajor.toFixed(2)} more`;
    }

    const taxNote =
        rule.taxRate > 0
            ? `Incl. ${(rule.taxRate * 100).toFixed(0)}% ${rule.taxLabel ?? "tax"}`
            : undefined;

    return { subtotal, shipping, tax, total, currency, shippingNote, taxNote };
}
