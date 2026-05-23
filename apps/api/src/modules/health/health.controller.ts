import { healthService } from "./health.service";
import { asyncHandler } from "../../lib/asyncHandler";

export const checkHealth = asyncHandler(async (req, res) => {
    const result = await healthService.check();
    const status = result.status === "ok" ? 200 : 503;
    res.status(status).json(result);
});
