import type { RequestHandler } from "express";
import { reconciliationService } from "./reconciliation.service";
import { asyncHandler } from "../../lib/asyncHandler";
import { AppError } from "../../lib/errors";

export const listReports: RequestHandler = asyncHandler(async (req, res) => {
    const { limit } = req.query as unknown as { limit: number };
    const reports = await reconciliationService.list(limit);
    res.json({ reports });
});

export const getReport: RequestHandler = asyncHandler(async (req, res) => {
    const report = await reconciliationService.getById(String(req.params.id));
    if (!report) {
        throw AppError.notFound(
            "NOT_FOUND",
            "Reconciliation report not found",
        );
    }
    res.json(report);
});
