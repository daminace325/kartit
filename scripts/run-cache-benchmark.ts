/**
 * Cache benchmark orchestrator.
 *
 * Measures how much Redis caching reduces Postgres reads by running an
 * identical k6 read-workload twice against the SAME API process:
 *
 *   1. baseline  — cache OFF  → every cacheable read hits Postgres
 *   2. cached    — cache ON   → hot reads are served from Redis
 *
 * X% = (dbReads_baseline − dbReads_cached) / dbReads_baseline × 100
 *
 * The API must be running with BOTH flags set so the /internal endpoints
 * exist and Prisma counts read queries:
 *
 *   $env:EXPOSE_TEST_METRICS="true"; $env:DISABLE_RATE_LIMITING="true"; npm run dev:api
 *
 * Then, from the repo root:
 *
 *   npm run bench:cache
 *   npm run bench:cache -- --vus 50 --iterations 8000
 */

import { execSync } from "node:child_process";
import { prisma, PromotionType } from "@repo/db";

// ─── Config ────────────────────────────────────────────────────────────

const API_BASE = process.env.API_BASE_URL || "http://localhost:5000";
const PROMO_CODE = process.env.PROMO_CODE || "BENCH10";

function argVal(flag: string, fallback: number): number {
    const i = process.argv.indexOf(flag);
    if (i !== -1 && process.argv[i + 1]) return Number(process.argv[i + 1]);
    return fallback;
}
const VUS = argVal("--vus", 50);
const ITERATIONS = argVal("--iterations", 6000);

// ─── HTTP helpers (talk to the API's /internal endpoints) ──────────────

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Node closes idle keep-alive sockets after ~5s. The k6 run blocks for longer,
// so undici's pooled socket from a pre-run POST can be dead by the time we read
// metrics back → ECONNRESET. Retry on a fresh connection a few times.
async function fetchRetry(url: string, init?: RequestInit, attempts = 6): Promise<Response> {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
        try {
            return await fetch(url, init);
        } catch (err) {
            lastErr = err;
            await sleep(400 * (i + 1));
        }
    }
    throw lastErr;
}

async function getMetrics(): Promise<{
    cacheDisabled: boolean;
    dbReads: number;
    caches: {
        byPrefix: Record<string, { hits: number; misses: number; hitRate: number }>;
        totalHits: number;
        totalMisses: number;
        overallHitRate: number;
    };
}> {
    const res = await fetchRetry(`${API_BASE}/internal/metrics`);
    if (res.status === 404) {
        throw new Error(
            "GET /internal/metrics returned 404 — start the API with EXPOSE_TEST_METRICS=true.",
        );
    }
    if (!res.ok) throw new Error(`GET /internal/metrics failed: ${res.status}`);
    return res.json() as never;
}

async function post(path: string, body?: unknown): Promise<void> {
    const res = await fetchRetry(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "fetch" },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
}

// ─── Preflight: API reachable, catalog seeded, promo present ───────────

async function preflight(): Promise<void> {
    try {
        await getMetrics();
    } catch (err) {
        console.error(`\n✗ ${(err as Error).message}\n`);
        console.error(
            "  Start it with:\n" +
                '    $env:EXPOSE_TEST_METRICS="true"; $env:DISABLE_RATE_LIMITING="true"; npm run dev:api\n',
        );
        process.exit(1);
    }

    const productCount = await prisma.product.count({ where: { isActive: true } });
    if (productCount === 0) {
        console.log("  No products found — running 'npm run db:seed'...");
        execSync("npm run db:seed", { stdio: "inherit" });
    } else {
        console.log(`  Catalog OK — ${productCount} active products.`);
    }

    // Upsert a known promo so the /cart/summary slice exercises promotionCache.
    await prisma.promotion.upsert({
        where: { code: PROMO_CODE },
        update: { isActive: true },
        create: {
            code: PROMO_CODE,
            type: PromotionType.PERCENTAGE,
            value: 1000n, // basis points → 10.00% off
            isActive: true,
        },
    });
    console.log(`  Promo "${PROMO_CODE}" ready (10% off).`);
}

// ─── One benchmark phase ───────────────────────────────────────────────

async function runPhase(phase: string, cacheDisabled: boolean) {
    console.log(`\n──────── phase: ${phase} (cache ${cacheDisabled ? "OFF" : "ON"}) ────────`);
    await post("/internal/cache/toggle", { disabled: cacheDisabled });
    await post("/internal/cache/flush");
    await post("/internal/metrics/reset");

    execSync(
        `k6 run k6/cache-benchmark.js ` +
            `-e API_BASE_URL=${API_BASE} -e VUS=${VUS} -e ITERATIONS=${ITERATIONS} ` +
            `-e PHASE=${phase} -e PROMO_CODE=${PROMO_CODE}`,
        { stdio: "inherit" },
    );

    // Let the server settle and any stale keep-alive sockets get evicted
    // before we read the counters back.
    await sleep(500);
    const metrics = await getMetrics();
    console.log(`  → ${phase}: ${metrics.dbReads} DB reads`);
    return metrics;
}

// ─── Report ────────────────────────────────────────────────────────────

function pct(n: number): string {
    return `${(n * 100).toFixed(1)}%`;
}

function printReport(
    baselineReads: number,
    cachedReads: number,
    cached: Awaited<ReturnType<typeof runPhase>>,
) {
    const reduction = baselineReads > 0 ? (baselineReads - cachedReads) / baselineReads : 0;

    const lines: string[] = [];
    const w = 64;
    lines.push("┌" + "─".repeat(w) + "┐");
    lines.push("│" + "  REDIS CACHE BENCHMARK — DB READ REDUCTION".padEnd(w) + "│");
    lines.push("├" + "─".repeat(w) + "┤");
    const row = (a: string, b: string) => `│  ${a.padEnd(w - 4 - b.length)}${b}  │`;
    lines.push(row("Workload", `${ITERATIONS} reqs × ${VUS} VUs`));
    lines.push(row("DB reads — cache OFF (baseline)", String(baselineReads)));
    lines.push(row("DB reads — cache ON  (cached)", String(cachedReads)));
    lines.push(row("DB reads eliminated", String(baselineReads - cachedReads)));
    lines.push("│" + " ".repeat(w) + "│");
    lines.push(row("➜ DB READ REDUCTION", pct(reduction)));
    lines.push(row("➜ Overall cache hit ratio", pct(cached.caches.overallHitRate)));
    lines.push("├" + "─".repeat(w) + "┤");
    lines.push("│" + "  Per-cache hit ratio (cached phase)".padEnd(w) + "│");
    for (const [prefix, s] of Object.entries(cached.caches.byPrefix)) {
        lines.push(row(`  ${prefix}`, `${pct(s.hitRate)}  (${s.hits}/${s.hits + s.misses})`));
    }
    lines.push("└" + "─".repeat(w) + "┘");
    console.log("\n" + lines.join("\n") + "\n");

    return reduction;
}

// ─── Main ──────────────────────────────────────────────────────────────

async function main() {
    console.log("\nCache benchmark — preflight...");
    await preflight();

    const baseline = await runPhase("baseline", true);
    const cached = await runPhase("cached", false);

    const reduction = printReport(baseline.dbReads, cached.dbReads, cached);

    // Re-enable the cache so the API is left in a normal state.
    await post("/internal/cache/toggle", { disabled: false });

    const summary = {
        timestamp: new Date().toISOString(),
        config: { apiBase: API_BASE, vus: VUS, iterations: ITERATIONS, promoCode: PROMO_CODE },
        baselineDbReads: baseline.dbReads,
        cachedDbReads: cached.dbReads,
        dbReadsEliminated: baseline.dbReads - cached.dbReads,
        dbReadReduction: reduction,
        overallHitRate: cached.caches.overallHitRate,
        perCacheHitRate: cached.caches.byPrefix,
    };

    const { writeFileSync } = await import("node:fs");
    writeFileSync(
        "k6/results/cache-benchmark-summary.json",
        JSON.stringify(summary, null, 2),
    );
    console.log("Wrote k6/results/cache-benchmark-summary.json");
}

main()
    .catch((err) => {
        console.error("\nBenchmark failed:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
