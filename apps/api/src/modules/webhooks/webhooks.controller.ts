import type { RequestHandler } from "express";
import { webhooksService } from "./webhooks.service";
import { asyncHandler } from "../../lib/asyncHandler";

export const retryWebhook: RequestHandler = asyncHandler(async (req, res) => {
    const result = await webhooksService.retry(String(req.params.id));
    res.json(result);
});
