import { Router } from "express";
import type { RequestHandler } from "express";
import { getDbReadCount, resetDbReadCount } from "@repo/db";
import {
    getCacheStats,
    resetCacheStats,
    setCacheDisabled,
    isCacheDisabled,
    flushAllCaches,
} from "../../lib/cache";
import { asyncHandler } from "../../lib/asyncHandler";

// Test/benchmark-only router. Mounted ONLY when EXPOSE_TEST_METRICS=true
// (see app.ts), so these endpoints never exist in production. They let the
// cache benchmark (scripts/run-cache-benchmark.ts) measure DB-read reduction
// and flip the cache on/off without restarting the API.
export const internalRouter: Router = Router();

// Snapshot the cache hit/miss stats + cumulative DB read count.
const getMetrics: RequestHandler = (_req, res) => {
    res.json({
        cacheDisabled: isCacheDisabled(),
        dbReads: getDbReadCount(),
        caches: getCacheStats(),
    });
};

// Zero both counters — call before each benchmark phase.
const resetMetrics: RequestHandler = (_req, res) => {
    resetCacheStats();
    resetDbReadCount();
    res.json({ ok: true });
};

// Flip the read cache on/off at runtime (A/B without an API restart).
const toggleCache: RequestHandler = (req, res) => {
    const disabled = (req.body as { disabled?: unknown })?.disabled === true;
    setCacheDisabled(disabled);
    res.json({ ok: true, cacheDisabled: isCacheDisabled() });
};

// Cold-start the cache by deleting every cache:* key.
const flushCache: RequestHandler = asyncHandler(async (_req, res) => {
    const deleted = await flushAllCaches();
    res.json({ ok: true, deleted });
});

internalRouter.get("/metrics", getMetrics);
internalRouter.post("/metrics/reset", resetMetrics);
internalRouter.post("/cache/toggle", toggleCache);
internalRouter.post("/cache/flush", flushCache);
