import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { healthRouter } from "./modules/health/health.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { categoriesRouter } from "./modules/categories/categories.routes";
import { productsRouter } from "./modules/products/products.routes";
import { imagesRouter } from "./modules/images/images.routes";
import { cartRouter } from "./modules/cart/cart.routes";
import { ordersRouter } from "./modules/orders/orders.routes";
import { paymentsRouter } from "./modules/payments/payments.routes";
import { addressesRouter } from "./modules/addresses/addresses.routes";
import { promotionsRouter } from "./modules/promotions/promotions.routes";
import { docsRouter } from "./modules/docs/docs.routes";
import { ledgerRouter } from "./modules/ledger/ledger.routes";
import { reconciliationRouter } from "./modules/reconciliation/reconciliation.routes";
import { webhooksRouter } from "./modules/webhooks/webhooks.routes";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { csrfMiddleware } from "./middlewares/csrf";
import { createTokenBucketLimiter } from "./middlewares/rateLimiter";

// Compile WEB_ORIGINS once. Each entry is either an exact origin
// ("https://app.example.com") or a single-`*`-wildcard host
// ("https://*.vercel.app") for preview deployments.
const originMatchers = env.WEB_ORIGINS.map((origin) => {
    if (!origin.includes("*")) return (o: string) => o === origin;
    const pattern = new RegExp(
        "^" + origin.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^.]+") + "$",
    );
    return (o: string) => pattern.test(o);
});

const corsOriginCheck: cors.CorsOptions["origin"] = (origin, cb) => {
    // Same-origin / curl / server-to-server requests have no Origin header.
    if (!origin) return cb(null, true);
    if (originMatchers.some((match) => match(origin))) return cb(null, true);
    return cb(null, false);
};

export function createApp() {
    const app = express();

    // Render / Vercel / any LB sits in front of us. Required for `req.secure`,
    // correct `req.ip`, and the `Secure` cookie attribute to behave.
    app.set("trust proxy", 1);

    app.use(helmet());

    app.use(
        cors({
            origin: corsOriginCheck,
            credentials: true,
        }),
    );

    // Key generator for authenticated endpoints: keys on user ID with
    // fallback to IP, avoiding shared-NAT collisions.
    const authenticatedKeyGenerator = (req: express.Request) =>
        req.user?.id ?? (req.ip ?? "unknown");

    // ── Redis-backed token-bucket rate limiters ──────────────────
    // Each limiter enforces a sustained rate (tokens/sec) with a
    // configurable burst capacity. All state lives in Redis so limits
    // are shared across API instances behind a load balancer.
    //
    // Set DISABLE_RATE_LIMITING=true to bypass all rate limiting (load tests).

    const skipIfDisabled = () => env.DISABLE_RATE_LIMITING;

    // Rate-limit payment intent creation. Must be mounted BEFORE the payments
    // router so it runs before the route handler.
    const paymentIntentLimiter = createTokenBucketLimiter({
        prefix: "ratelimit:pi",
        capacity: 20,
        rate: 20 / (15 * 60),        // 20 tokens per 15-min window
        keyGenerator: authenticatedKeyGenerator,
        skip: () => skipIfDisabled(),
    });
    app.use("/payments/intent", paymentIntentLimiter);

    // CSRF protection for state-changing requests.
    // /payments/webhook is excluded because Stripe sends server-to-server
    // requests without a browser origin or the X-Requested-With header.
    // Mounted before express.json() — CSRF only inspects headers.
    app.use(csrfMiddleware({ skipPaths: ["/payments/webhook", "/payments/webhook/test"] }));

    // Stripe webhook MUST see the raw request body for signature verification.
    // Mounted BEFORE express.json() so the global JSON parser doesn't consume
    // the body. The router-local express.raw() in payments.routes.ts handles parsing.
    app.use("/payments", paymentsRouter);

    app.use(express.json());
    app.use(cookieParser());

    // Throttle credential endpoints to slow down brute-force / stuffing.
    const authLimiter = createTokenBucketLimiter({
        prefix: "ratelimit:auth",
        capacity: 30,
        rate: 30 / (15 * 60),        // 30 tokens per 15-min window
        skip: () => skipIfDisabled(),
    });
    app.use("/auth/signin", authLimiter);
    app.use("/auth/signup", authLimiter);

    // Tighter limits for sensitive authenticated endpoints.
    const changePasswordLimiter = createTokenBucketLimiter({
        prefix: "ratelimit:chpwd",
        capacity: 10,
        rate: 10 / (15 * 60),        // 10 tokens per 15-min window
        keyGenerator: authenticatedKeyGenerator,
        skip: () => skipIfDisabled(),
    });
    app.use("/auth/change-password", changePasswordLimiter);

    const createOrderLimiter = createTokenBucketLimiter({
        prefix: "ratelimit:order",
        capacity: 20,
        rate: 20 / (15 * 60),        // 20 tokens per 15-min window
        keyGenerator: authenticatedKeyGenerator,
        skip: (req) => skipIfDisabled() || req.method !== "POST",
    });
    app.use("/orders", createOrderLimiter);

    // Rate-limit cart summary — triggers promo-code validation (up to
    // 3 extra DB queries) and stock revalidation, making it a target
    // for promo-code enumeration.
    const cartSummaryLimiter = createTokenBucketLimiter({
        prefix: "ratelimit:cart-summary",
        capacity: 20,
        rate: 20 / (15 * 60),        // 20 tokens per 15-min window
        keyGenerator: authenticatedKeyGenerator,
        skip: () => skipIfDisabled(),
    });
    app.use("/cart/summary", cartSummaryLimiter);

    // Rate-limit image uploads — Cloudinary bills by usage (bandwidth,
    // storage, transformations) and multer buffers files in memory.
    const imageUploadLimiter = createTokenBucketLimiter({
        prefix: "ratelimit:upload",
        capacity: 10,
        rate: 10 / (15 * 60),        // 10 uploads per 15-min window
        keyGenerator: authenticatedKeyGenerator,
        skip: () => skipIfDisabled(),
    });
    app.use("/images/upload", imageUploadLimiter);

    app.get("/", (req, res) => {
        res.json({ message: "API is running 🚀" });
    });

    app.use("/health", healthRouter);
    app.use("/auth", authRouter);
    app.use("/categories", categoriesRouter);
    app.use("/products", productsRouter);
    app.use("/images", imagesRouter);
    app.use("/cart", cartRouter);
    app.use("/orders", ordersRouter);
    app.use("/addresses", addressesRouter);
    app.use("/promotions", promotionsRouter);
    app.use("/admin/ledger", ledgerRouter);
    app.use("/admin/reconciliation", reconciliationRouter);
    app.use("/admin/webhooks", webhooksRouter);
    app.use("/docs", docsRouter);

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
