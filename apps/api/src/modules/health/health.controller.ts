import { RequestHandler } from "express";
import { healthService } from "./health.service";

export const checkHealth: RequestHandler = async (req, res) => {
  try {
    const result = await healthService.check();
    res.json(result);
  } catch (err) {
    res.status(503).json({
      status: "error",
      db: "down",
      message: err instanceof Error ? err.message : "unknown",
    });
  }
};
