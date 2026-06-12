import { Router } from "express";
import { reconciliationListQuerySchema } from "@repo/shared";
import { validate } from "../../middlewares/validate";
import { requireAuth, requireAdmin } from "../../middlewares/requireAuth";
import { listReports, getReport } from "./reconciliation.controller";

export const reconciliationRouter: Router = Router();

reconciliationRouter.use(requireAuth, requireAdmin);

// GET /admin/reconciliation — list recent reports
reconciliationRouter.get("/", validate(reconciliationListQuerySchema, "query"), listReports);

// GET /admin/reconciliation/:id — single report detail
reconciliationRouter.get("/:id", getReport);
