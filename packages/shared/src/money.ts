// Money is stored everywhere as integer minor units (1999 = $19.99).
// Currency is an ISO 4217 code (e.g. "USD", "INR").

const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF",
  "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

export function decimalsFor(currency: string): number {
    return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2;
}

/**
 * Format minor units as a localized currency string.
 * formatMoney(1999n, "USD") -> "$19.99"
 */
export function formatMoney(
    amountMinor: bigint | number | string,
    currency: string,
    locale: string = "en-US",
): string {
    const decimals = decimalsFor(currency);
    const value = Number(amountMinor) / 10 ** decimals;
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currency.toUpperCase(),
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value);
}

/**
 * Parse a user-input string into minor units.
 * parseMoney("19.99", "USD") -> 1999n
 * Throws if the input is not a valid number for the given currency.
 */
export function minorToMajor(minor: string | number | bigint, currency: string): string;
export function minorToMajor(minor: string | number | bigint, decimals: number): string;
export function minorToMajor(minor: string | number | bigint, arg: string | number): string {
    const decimals = typeof arg === "string" ? decimalsFor(arg) : arg;
    const m = BigInt(minor);
    if (decimals === 0) return m.toString();
    const factor = 10n ** BigInt(decimals);
    const whole = m / factor;
    const frac = (m % factor).toString().padStart(decimals, "0");
    return `${whole}.${frac}`;
}

export function majorToMinor(major: string, currency: string): string;
export function majorToMinor(major: string, decimals: number): string;
export function majorToMinor(major: string, arg: string | number): string {
    const decimals = typeof arg === "string" ? decimalsFor(arg) : arg;
    const trimmed = major.trim();
    if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error("Invalid price");
    const [whole, frac = ""] = trimmed.split(".");
    const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
    return decimals === 0
        ? whole
        : (BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fracPadded || "0")).toString();
}

export function parseMoney(input: string, currency: string): bigint {
    const trimmed = input.trim().replace(/,/g, "");
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
        throw new Error(`Invalid money string: "${input}"`);
    }
    const decimals = decimalsFor(currency);
    const [whole, frac = ""] = trimmed.split(".");
    const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
    const sign = whole.startsWith("-") ? -1n : 1n;
    const wholeAbs = whole.replace("-", "");
    return sign * (BigInt(wholeAbs) * 10n ** BigInt(decimals) + BigInt(fracPadded || "0"));
}
