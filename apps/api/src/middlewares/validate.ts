import type { RequestHandler } from "express";
import { type ZodType } from "zod";
import { AppError } from "../lib/errors";

type Source = "body" | "query" | "params";

export const validate =
    (schema: ZodType, source: Source = "body"): RequestHandler =>
    (req, res, next) => {
        const result = schema.safeParse(req[source]);
        if (!result.success) {
            return next(
                AppError.badRequest("VALIDATION_FAILED", "Invalid request", result.error.flatten()),
            );
        }
        // In Express 5 `req.query` is a getter-only property, so we can't reassign.
        // Define a writable property to overwrite the parsed (typed + defaulted) value.
        Object.defineProperty(req, source, {
            value: result.data,
            writable: true,
            configurable: true,
            enumerable: true,
        });
        next();
    };
