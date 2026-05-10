import { Router } from "express";
import { checkHealth } from "./health.controller";

export const healthRouter: Router = Router();

// Liveness probe: process is up. Used by Render for restart decisions.
// Must NOT touch the DB — a DB outage shouldn't cycle the api process.
healthRouter.get("/live", (_req, res) => {
    res.json({ status: "ok" });
});

// Readiness / full health: also pings the DB. Use for monitoring + manual checks.
healthRouter.get("/", checkHealth);
