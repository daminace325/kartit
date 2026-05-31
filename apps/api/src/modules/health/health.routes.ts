import { Router } from "express";
import { checkHealth } from "./health.controller";

export const healthRouter: Router = Router();

// Liveness probe: process is up. Used by Render for restart decisions.
// Must NOT touch the DB or Redis — a dependency outage shouldn't cycle the api process.
healthRouter.get("/live", (_req, res) => {
    res.json({ status: "ok" });
});

// Readiness probe: requires DB + Redis. Used by orchestrators to decide
// whether this instance should receive traffic.
healthRouter.get("/readyz", checkHealth);

// Full health: also pings DB + Redis. Use for monitoring + manual checks.
healthRouter.get("/", checkHealth);
