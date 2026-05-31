import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middlewares/requireAuth";
import { getLedgerSummary, getLedgerEntries } from "./ledger.controller";

export const ledgerRouter: Router = Router();

ledgerRouter.use(requireAuth, requireAdmin);

// GET /admin/ledger — balance summary per account
ledgerRouter.get("/", getLedgerSummary);

// GET /admin/ledger/entries — paginated detail rows
ledgerRouter.get("/entries", getLedgerEntries);
