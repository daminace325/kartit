import { Router } from "express";
import { requireAuth, requireAdmin } from "../../middlewares/requireAuth";
import { retryWebhook } from "./webhooks.controller";

export const webhooksRouter: Router = Router();

webhooksRouter.use(requireAuth, requireAdmin);

// POST /admin/webhooks/:id/retry — manually retry a failed webhook event
webhooksRouter.post("/:id/retry", retryWebhook);
