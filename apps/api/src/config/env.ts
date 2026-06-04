import "dotenv/config";

const required = (key: string): string => {
    const v = process.env[key];
    if (!v) throw new Error(`Missing env var: ${key}`);
    return v;
};

const NODE_ENV = process.env.NODE_ENV ?? "development";
const isProd = NODE_ENV === "production";

const requireInProd = (key: string): string => {
    const v = process.env[key] ?? "";
    if (isProd && !v) throw new Error(`Missing env var (required in production): ${key}`);
    return v;
};

const parseOrigins = (raw: string | undefined): string[] =>
    (raw ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

const sameSiteOptions = ["lax", "strict", "none"] as const;
type SameSite = (typeof sameSiteOptions)[number];
const parseSameSite = (raw: string | undefined): SameSite => {
    const v = (raw ?? "lax").toLowerCase();
    return (sameSiteOptions as readonly string[]).includes(v) ? (v as SameSite) : "lax";
};

const JWT_SECRET = required("JWT_SECRET");
if (JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters");
}

const COOKIE_SAMESITE = parseSameSite(process.env.COOKIE_SAMESITE);
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";
if (COOKIE_SAMESITE === "none" && !COOKIE_SECURE) {
    throw new Error("COOKIE_SAMESITE=none requires COOKIE_SECURE=true");
}

const WEB_ORIGINS = parseOrigins(process.env.WEB_ORIGINS ?? process.env.WEB_ORIGIN);
if (WEB_ORIGINS.length === 0) WEB_ORIGINS.push("http://localhost:3000");

// Fast-fail: validate DATABASE_URL is set at startup even though no code reads
// env.DATABASE_URL directly (Prisma reads process.env.DATABASE_URL).
required("DATABASE_URL");

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

export const env = {
    isProd,
    PORT: Number(process.env.PORT) || 5000,

    JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",
    COOKIE_NAME: process.env.COOKIE_NAME ?? "ecomm_auth",
    COOKIE_SECURE,
    COOKIE_SAMESITE,

    WEB_ORIGINS,

    CLOUDINARY_CLOUD_NAME: requireInProd("CLOUDINARY_CLOUD_NAME"),
    CLOUDINARY_API_KEY: requireInProd("CLOUDINARY_API_KEY"),
    CLOUDINARY_API_SECRET: requireInProd("CLOUDINARY_API_SECRET"),
    CLOUDINARY_FOLDER: process.env.CLOUDINARY_FOLDER ?? "ecomm/products",

    // Stripe — required in prod so order/payment routes never silently 500.
    STRIPE_SECRET_KEY: requireInProd("STRIPE_SECRET_KEY"),
    STRIPE_WEBHOOK_SECRET: requireInProd("STRIPE_WEBHOOK_SECRET"),
    STRIPE_CURRENCY: (process.env.STRIPE_CURRENCY ?? "USD").toUpperCase(),

    REDIS_URL,

    DISABLE_RATE_LIMITING: process.env.DISABLE_RATE_LIMITING === "true",
};
