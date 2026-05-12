import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
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
    return cb(new Error(`CORS: origin ${origin} not allowed`));
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

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
