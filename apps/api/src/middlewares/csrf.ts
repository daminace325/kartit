import { RequestHandler } from "express";
import { AppError } from "../lib/errors";

/**
 * CSRF protection for state-changing requests.
 * Requires the `X-Requested-With: fetch` header on all mutating requests
 * (POST, PUT, PATCH, DELETE). This header is automatically set by the
 * browser when using fetch(), but not by cross-site form submissions.
 *
 * Excludes `/payments/webhook` - Stripe sends webhooks from their servers
 * and won't include this header.
 */
export const csrfMiddleware: RequestHandler = (req, res, next) => {
    // Skip for safe methods (GET, HEAD, OPTIONS) - these don't modify state.
    const method = req.method.toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
        return next();
    }

    // Skip webhook endpoints - these are called by external services.
    const path = req.path;
    if (path.startsWith("/webhook") || path === "/webhook") {
        return next();
    }

    // Require the CSRF header on state-changing requests.
    const csrfHeader = req.headers["x-requested-with"];
    if (csrfHeader !== "fetch") {
        return next(
            AppError.forbidden(
                "CSRF_INVALID",
                "Missing required security header. Ensure requests are made from the application.",
            ),
        );
    }

    next();
};