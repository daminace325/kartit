import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import { AppError } from "../lib/errors";

export const notFoundHandler: RequestHandler = (req, res) => {
    res.status(404).json({
        error: { code: "NOT_FOUND", message: `Route ${req.method} ${req.path} not found` },
    });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    if (res.headersSent) return next(err);

    if (err instanceof AppError) {
        res.status(err.status).json({
            error: { code: err.code, message: err.message, details: err.details },
        });
        return;
    }

    if (err instanceof multer.MulterError) {
        const code = err.code === "LIMIT_FILE_SIZE" ? "FILE_TOO_LARGE" : "UPLOAD_FAILED";
        res.status(400).json({
            error: { code, message: err.message },
        });
        return;
    }

    // multer fileFilter rejection comes through as a plain Error.
    if (err instanceof Error && err.message.startsWith("Invalid file type")) {
        res.status(400).json({
            error: { code: "INVALID_FILE_TYPE", message: err.message },
        });
        return;
    }

    console.error("[unhandled error]", err);
    res.status(500).json({
        error: { code: "INTERNAL", message: "Internal server error" },
    });
};
