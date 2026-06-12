import { ledgerService } from "./ledger.service";
import { asyncHandler } from "../../lib/asyncHandler";

export const getLedgerSummary = asyncHandler(async (req, res) => {
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : undefined;
    const result = await ledgerService.summary(startDate, endDate);
    res.json(result);
});

export const getLedgerEntries = asyncHandler(async (req, res) => {
    const { account, startDate, endDate, cursor, limit } = req.query as unknown as {
        account?: string; startDate?: string; endDate?: string; cursor?: string; limit: number;
    };
    const result = await ledgerService.entries(account, startDate, endDate, cursor, limit);
    res.json(result);
});
