/**
 * k6 — Idempotency stress test
 *
 * Goal: Prove that under N concurrent identical POST /orders requests
 * sharing one Idempotency-Key, EXACTLY 1 order is created in the database.
 *
 * What this exercises:
 *   - Redis SET NX atomic claim (apps/api/src/middlewares/idempotency-redis.ts)
 *   - Postgres fallback path if Redis is unreachable
 *   - 24-hour response cache for replays
 *   - Request-body hashing for conflict detection
 *
 * Expected outcome (burst of N concurrent requests, all identical):
 *   • 1 × 201 "original"            — the request that won the SET NX claim
 *   • Most × 409 IN_PROGRESS         — concurrent racers blocked by the claim
 *                                      while the winner's handler runs
 *   • Some × 201 with Idempotency-Replayed: true
 *                                    — late requests served from cache after
 *                                      the winner completed
 *   • 0 × 409 CONFLICT              — any conflict here would indicate a BUG
 *                                      (claim found with a different body hash)
 *   • DB count = 1                  — verified by scripts/verify-idempotency.ts
 *
 * Prerequisites:
 *   1. Seed users:
 *        npm run seed:k6
 *
 *   2. Restart API with rate limiting disabled (we intentionally hammer one
 *      user; rate limits would mask the real behavior):
 *        $env:DISABLE_RATE_LIMITING="true"
 *        npm run dev:api
 *
 * Usage:
 *   # Default 500 concurrent requests
 *   k6 run k6/idempotency-stress.js
 *
 *   # Custom burst size
 *   k6 run k6/idempotency-stress.js -e VUS=1000
 *
 *   # Different test user
 *   k6 run k6/idempotency-stress.js -e TEST_USER_EMAIL=k6-seed-5@test.com
 *
 * After the run:
 *   npm run verify:idem
 *
 * Cleanup between runs:
 *   npm run cleanup:k6 && npm run seed:k6
 */

import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";

// ─── Config ────────────────────────────────────────────────────────────

const API_BASE = __ENV.API_BASE_URL || "http://localhost:5000";
const VUS = Number(__ENV.VUS) || 200;
const TEST_USER_EMAIL = __ENV.TEST_USER_EMAIL || "k6-seed-0@test.com";
const PASSWORD = "k6test123";

// ─── Custom metrics — one per response category ────────────────────────

const originalsCounter = new Counter("idem_originals");         // 201, no replay header
const replaysCounter = new Counter("idem_replays");             // 201, Idempotency-Replayed: true
const inProgressCounter = new Counter("idem_in_progress");      // 409 IDEMPOTENCY_IN_PROGRESS
const conflictCounter = new Counter("idem_conflicts");          // 409 IDEMPOTENCY_CONFLICT (BUG)
const unexpectedCounter = new Counter("idem_unexpected");       // anything else

// ─── Scenario: simultaneous burst ──────────────────────────────────────
//
// shared-iterations distributes a fixed total of iterations across VUs.
// With VUS == iterations, each VU sends exactly 1 request. All VUs start
// at the same time, so this is the closest approximation of a true
// concurrent burst that k6 supports.

export const options = {
    scenarios: {
        burst: {
            executor: "shared-iterations",
            vus: VUS,
            iterations: VUS,
            maxDuration: "60s",
        },
    },
    thresholds: {
        // At most 1 request may actually create an order — that's the
        // whole point of this test.
        idem_originals: ["count<=1"],
        // Any CONFLICT means the middleware saw two requests with the
        // same key but different body hashes. Since this test uses
        // identical bodies, any CONFLICT is a bug.
        idem_conflicts: ["count==0"],
    },
};

// ─── Helpers ───────────────────────────────────────────────────────────

function extractCookie(res, name) {
    const setCookie = res.headers["Set-Cookie"];
    if (!setCookie) return null;
    const match = setCookie.match(new RegExp(`${name}=([^;]+)`));
    return match ? match[1] : null;
}

/**
 * Case-insensitive header lookup — Express sets "Idempotency-Replayed" but
 * different HTTP stacks normalize header case differently.
 */
function header(res, name) {
    const lower = name.toLowerCase();
    for (const k of Object.keys(res.headers)) {
        if (k.toLowerCase() === lower) return res.headers[k];
    }
    return undefined;
}

// ─── Setup (runs once before any VU iterates) ──────────────────────────

export function setup() {
    console.log(`\n[setup] Signing in as ${TEST_USER_EMAIL}...`);
    const signin = http.post(
        `${API_BASE}/auth/signin`,
        JSON.stringify({ email: TEST_USER_EMAIL, password: PASSWORD }),
        {
            headers: {
                "Content-Type": "application/json",
                "X-Requested-With": "fetch",
            },
        },
    );
    if (signin.status !== 200) {
        throw new Error(
            `signin failed: ${signin.status} — did you run 'npm run seed:k6'? body=${signin.body}`,
        );
    }
    const token = extractCookie(signin, "ecomm_auth");
    if (!token) throw new Error("no auth cookie set");

    console.log("[setup] Fetching a product...");
    const products = http.get(`${API_BASE}/products?limit=1`);
    if (products.status !== 200) {
        throw new Error(`product list failed: ${products.status}`);
    }
    const product = products.json("items.0");
    if (!product) throw new Error("no products available — seed the DB");

    console.log(`[setup] Adding 1x "${product.name}" to cart...`);
    const cart = http.post(
        `${API_BASE}/cart/items`,
        JSON.stringify({ productId: product.id, quantity: 1 }),
        {
            headers: {
                "Content-Type": "application/json",
                Cookie: `ecomm_auth=${token}`,
                "X-Requested-With": "fetch",
            },
        },
    );
    if (cart.status !== 201) {
        throw new Error(`cart add failed: ${cart.status} body=${cart.body}`);
    }

    console.log("[setup] Creating shipping address...");
    const addr = http.post(
        `${API_BASE}/addresses`,
        JSON.stringify({
            name: "Idem Stress Test",
            phone: "+15550009999",
            line1: "1 Idempotency Way",
            city: "Testville",
            state: "TS",
            postalCode: "12345",
            country: "US",
        }),
        {
            headers: {
                "Content-Type": "application/json",
                Cookie: `ecomm_auth=${token}`,
                "X-Requested-With": "fetch",
            },
        },
    );
    if (addr.status !== 201) {
        throw new Error(`address create failed: ${addr.status} body=${addr.body}`);
    }
    const addressId = addr.json("address.id");

    const idempotencyKey = `idem-stress-${Date.now()}`;
    console.log(`[setup] Ready. Idempotency-Key: ${idempotencyKey}`);
    console.log(`[setup] Firing ${VUS} simultaneous POST /orders...\n`);

    return { token, addressId, idempotencyKey };
}

// ─── Main — each VU fires 1 identical POST /orders ─────────────────────

export default function (data) {
    const res = http.post(
        `${API_BASE}/orders`,
        JSON.stringify({ shippingAddressId: data.addressId }),
        {
            headers: {
                "Content-Type": "application/json",
                Cookie: `ecomm_auth=${data.token}`,
                "X-Requested-With": "fetch",
                "Idempotency-Key": data.idempotencyKey,
            },
        },
    );

    if (res.status === 201) {
        if (header(res, "Idempotency-Replayed") === "true") {
            replaysCounter.add(1);
            check(res, { "cached replay": () => true });
        } else {
            originalsCounter.add(1);
            check(res, { "first creation (winner)": () => true });
        }
        return;
    }

    if (res.status === 409) {
        const code = res.json("error.code");
        if (code === "IDEMPOTENCY_IN_PROGRESS") {
            inProgressCounter.add(1);
        } else if (code === "IDEMPOTENCY_CONFLICT") {
            conflictCounter.add(1);
            console.warn(
                "CONFLICT detected — this should NEVER happen with identical bodies",
            );
        } else {
            unexpectedCounter.add(1);
            console.warn(`unexpected 409 code: ${code}`);
        }
        return;
    }

    unexpectedCounter.add(1);
    console.warn(
        `VU ${__VU}: unexpected status ${res.status} body=${String(res.body).slice(0, 200)}`,
    );
}

// ─── Summary ───────────────────────────────────────────────────────────

export function handleSummary(data) {
    const m = data.metrics;
    const count = (k) => m[k]?.values?.count || 0;

    const originals = count("idem_originals");
    const replays = count("idem_replays");
    const inProgress = count("idem_in_progress");
    const conflicts = count("idem_conflicts");
    const unexpected = count("idem_unexpected");
    const total = originals + replays + inProgress + conflicts + unexpected;

    const duplicatesPrevented = total - originals - unexpected;
    const correctlyHandled = originals + replays + inProgress;

    const rows = [
        ["Total requests fired", String(total)],
        ["", ""],
        ["201 originals (real order created)", String(originals)],
        ["201 replays (cached response)", String(replays)],
        ["409 IN_PROGRESS (claim race blocked)", String(inProgress)],
        ["409 CONFLICT (BUG if non-zero)", String(conflicts)],
        ["Unexpected (failures)", String(unexpected)],
        ["", ""],
        [
            "Correctly handled",
            `${correctlyHandled} / ${total} (${total > 0 ? ((correctlyHandled / total) * 100).toFixed(1) : 0}%)`,
        ],
        ["Duplicates prevented", String(duplicatesPrevented)],
    ];

    const c1 = Math.max(...rows.map((r) => r[0].length)) + 2;
    const c2 = Math.max(...rows.map((r) => r[1].length)) + 2;
    const w = c1 + c2 + 3;

    const lines = [];
    lines.push("┌" + "─".repeat(w) + "┐");
    lines.push("│" + "  K6 IDEMPOTENCY STRESS RESULTS".padEnd(w) + "│");
    lines.push("├" + "─".repeat(w) + "┤");
    for (const [a, b] of rows) {
        if (!a && !b) {
            lines.push("│" + " ".repeat(w) + "│");
        } else {
            const line = `  ${a.padEnd(c1)} ${String(b).padStart(c2)} `;
            lines.push("│" + line.padEnd(w) + "│");
        }
    }
    lines.push("└" + "─".repeat(w) + "┘");
    lines.push("");
    lines.push("Verify the DB outcome:  npm run verify:idem");
    lines.push("");

    console.log("\n" + lines.join("\n"));

    return {
        stdout: `originals=${originals} replays=${replays} in_progress=${inProgress} conflicts=${conflicts} unexpected=${unexpected}`,
        "k6/results/idempotency-summary.json": JSON.stringify(
            {
                timestamp: new Date().toISOString(),
                vus: VUS,
                total,
                originals,
                replays,
                inProgress,
                conflicts,
                unexpected,
                duplicatesPrevented,
            },
            null,
            2,
        ),
    };
}
