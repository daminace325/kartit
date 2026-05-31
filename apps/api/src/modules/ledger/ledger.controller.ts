import type { RequestHandler } from "express";
import { ledgerService } from "./ledger.service";
import { asyncHandler } from "../../lib/asyncHandler";

export const getLedgerSummary = asyncHandler(async (req, res) => {
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : undefined;
    const result = await ledgerService.summary(startDate, endDate);
    res.json(result);
});

export const getLedgerEntries = asyncHandler(async (req, res) => {
    const account = typeof req.query.account === "string" ? req.query.account : undefined;
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : undefined;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const result = await ledgerService.entries(account, startDate, endDate, cursor, Math.min(limit, 100));
    res.json(result);
});
