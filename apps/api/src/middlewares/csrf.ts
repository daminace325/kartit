import { RequestHandler } from "express";
import { AppError } from "../lib/errors";

/**
 * CSRF protection for state-changing requests.
 * Requires the `X-Requested-With: fetch` header on all mutating requests
 * (POST, PUT, PATCH, DELETE). This header must be explicitly set by
 * application code — it is not set automatically by browsers.
 */
export function csrfMiddleware({ skipPaths = [] }: { skipPaths?: string[] } = {}): RequestHandler {
    // Normalize skip paths: strip trailing slashes and ensure leading slash.
    const skipSet = new Set(
        skipPaths.map((p) => {
            const normalized = p.endsWith("/") ? p.slice(0, -1) : p;
            return normalized.startsWith("/") ? normalized : `/${normalized}`;
        }),
    );

    return (req, res, next) => {
        // Always allow GET, HEAD, OPTIONS.
        const method = req.method.toUpperCase();
        if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
            return next();
        }

        // Skip configured paths (e.g. webhook endpoints that receive
        // server-to-server requests without a browser origin).
        const reqPath = req.path.endsWith("/") ? req.path.slice(0, -1) : req.path;
        if (skipSet.has(reqPath)) {
            return next();
        }

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
}