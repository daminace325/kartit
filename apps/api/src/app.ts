import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
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
import { docsRouter } from "./modules/docs/docs.routes";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { csrfMiddleware } from "./middlewares/csrf";

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
        req.user?.id ?? ipKeyGenerator(req.ip ?? "");

    // Rate-limit payment intent creation. Must be mounted BEFORE the payments
    // router so it runs before the route handler.
    const paymentIntentLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 20,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        keyGenerator: authenticatedKeyGenerator,
    });
    app.use("/payments/intent", paymentIntentLimiter);

    // Stripe webhook MUST see the raw request body for signature verification.
    // Mount it BEFORE express.json() so the global JSON parser doesn't consume
    // the body. The router-local express.raw() in payments.routes.ts handles parsing.
    app.use("/payments", paymentsRouter);

    app.use(express.json());
    app.use(cookieParser());

    // CSRF protection for state-changing requests.
    // Excludes /payments (webhooks handled before this middleware).
    app.use(csrfMiddleware);

    // Throttle credential endpoints to slow down brute-force / stuffing.
    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 30,
        standardHeaders: "draft-7",
        legacyHeaders: false,
    });
    app.use("/auth/signin", authLimiter);
    app.use("/auth/signup", authLimiter);

    // Tighter limits for sensitive authenticated endpoints.
    const changePasswordLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 10,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        keyGenerator: authenticatedKeyGenerator,
    });
    app.use("/auth/change-password", changePasswordLimiter);

    const createOrderLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 20,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        keyGenerator: authenticatedKeyGenerator,
        skip: (req) => req.method !== "POST",
    });
    app.use("/orders", createOrderLimiter);

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
    app.use("/docs", docsRouter);

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
