import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middlewares/requireAuth";
import { listReports, getReport } from "./reconciliation.controller";

export const reconciliationRouter: Router = Router();

reconciliationRouter.use(requireAuth, requireAdmin);

// GET /admin/reconciliation — list recent reports
reconciliationRouter.get("/", listReports);

// GET /admin/reconciliation/:id — single report detail
reconciliationRouter.get("/:id", getReport);
