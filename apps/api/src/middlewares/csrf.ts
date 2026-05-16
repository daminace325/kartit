import { RequestHandler } from "express";
import { AppError } from "../lib/errors";

/**
 * CSRF protection for state-changing requests.
 * Requires the `X-Requested-With: fetch` header on all mutating requests
 * (POST, PUT, PATCH, DELETE). This header is automatically set by the
 * browser when using fetch(), but not by cross-site form submissions.
 *
 * Webhook endpoints are excluded via middleware ordering in app.ts (the
 * payments router is mounted before this middleware), not by path check here.
 */
export const csrfMiddleware: RequestHandler = (req, res, next) => {
    // Skip for safe methods (GET, HEAD, OPTIONS) - these don't modify state.
    const method = req.method.toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
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