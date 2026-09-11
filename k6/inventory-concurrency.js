/**
 * k6 concurrency test — Inventory safety under SIMULTANEOUS checkout.
 *
 * Run via the orchestrator, which seeds the SKU and verifies the DB after:
 *   npm run bench:inventory
 *   npm run bench:inventory -- --stock 10 --users 200
 *
 * How it works:
 *   setup()   pre-provisions USERS accounts, each with a shipping address and
 *             the test SKU already in their cart. This makes the measured
 *             action a TIGHT burst of simultaneous POST /orders — the true
 *             concurrency gate — instead of smearing it behind per-VU signup.
 *   default() fires exactly one POST /orders per VU (shared-iterations: USERS
 *             VUs each run a single iteration).
 *
 * With physicalStock = TARGET_STOCK, the per-product advisory lock in
 * reserveInventory() serialises reservation, so exactly TARGET_STOCK orders
 * succeed (201) and every other attempt is rejected (409 INSUFFICIENT_STOCK)
 * — zero oversell. The thresholds below fail the run if anything else happens.
 *
 * REQUIRES the API to run with DISABLE_RATE_LIMITING=true — USERS signups from
 * a single IP would otherwise be throttled by the auth limiter (30 / 15 min).
 *
 * Standalone (the SKU must already exist at the right stock):
 *   k6 run k6/inventory-concurrency.js -e USERS=200 -e TARGET_STOCK=10
 */

import http from "k6/http";
import { Counter, Trend } from "k6/metrics";

// ─── Config ────────────────────────────────────────────────────────────

const API_BASE = __ENV.API_BASE_URL || "http://localhost:5000";
const PRODUCT_SLUG = __ENV.PRODUCT_SLUG || "concurrency-test-sku";
const USERS = Number(__ENV.USERS) || 200;
const TARGET_STOCK = Number(__ENV.TARGET_STOCK) || 10;
const PASSWORD = "k6test123";
const EMAIL_PREFIX = "k6-concurrency-";

// ─── Custom metrics ─────────────────────────────────────────────────────

const ordersCreated = new Counter("orders_created");
const ordersRejected = new Counter("orders_rejected");
const ordersUnexpected = new Counter("orders_unexpected");
const orderDuration = new Trend("order_duration_ms", true);

export const options = {
    scenarios: {
        checkout_burst: {
            executor: "shared-iterations",
            vus: USERS,
            iterations: USERS,
            maxDuration: "2m",
        },
    },
    setupTimeout: "180s",
    thresholds: {
        // Exactly the available stock may convert to orders — zero oversell.
        orders_created: [`count === ${TARGET_STOCK}`],
        // Any non-201 / non-409 response (e.g. a 500) fails the run.
        orders_unexpected: ["count===0"],
    },
};

// ─── Helpers ────────────────────────────────────────────────────────────

function extractCookie(res, name) {
    const setCookie = res.headers["Set-Cookie"];
    if (!setCookie) return null;
    const match = setCookie.match(new RegExp(`${name}=([^;]+)`));
    return match ? match[1] : null;
}

function authHeaders(token) {
    return {
        "Content-Type": "application/json",
        Cookie: `ecomm_auth=${token}`,
        "X-Requested-With": "fetch",
    };
}

// ─── Setup: pre-provision USERS (signup → address → cart) ───────────────
//
// Runs once, before the burst, so each VU's only measured action is a single
// POST /orders that lands at the same instant as every other VU's.

export function setup() {
    const productRes = http.get(`${API_BASE}/products/slug/${PRODUCT_SLUG}`);
    if (productRes.status !== 200) {
        throw new Error(
            `product "${PRODUCT_SLUG}" not found (${productRes.status}) — run via 'npm run bench:inventory' so it is seeded to stock=${TARGET_STOCK}.`,
        );
    }
    const productId = productRes.json("product.id");

    console.log(`[setup] provisioning ${USERS} users (signup → address → cart)...`);
    const users = [];
    for (let i = 0; i < USERS; i++) {
        const email = `${EMAIL_PREFIX}${i}-${Date.now()}@test.com`;
        const su = http.post(
            `${API_BASE}/auth/signup`,
            JSON.stringify({ email, password: PASSWORD, name: `K6 Conc ${i}` }),
            { headers: { "Content-Type": "application/json", "X-Requested-With": "fetch" } },
        );
        if (su.status !== 201) {
            throw new Error(
                `signup ${i} failed (${su.status}) — is the API running with DISABLE_RATE_LIMITING=true? body=${su.body}`,
            );
        }
        const token = extractCookie(su, "ecomm_auth");
        if (!token) throw new Error(`no auth cookie for user ${i}`);

        const addr = http.post(
            `${API_BASE}/addresses`,
            JSON.stringify({
                name: "K6 Conc",
                phone: "555-0001",
                line1: "1 Race Way",
                city: "Testville",
                state: "TS",
                postalCode: "12345",
                country: "US",
            }),
            { headers: authHeaders(token) },
        );
        if (addr.status !== 201) throw new Error(`address ${i} failed (${addr.status})`);
        const addressId = addr.json("address.id");

        const cart = http.post(
            `${API_BASE}/cart/items`,
            JSON.stringify({ productId, quantity: 1 }),
            { headers: authHeaders(token) },
        );
        if (cart.status !== 201) throw new Error(`cart add ${i} failed (${cart.status})`);

        users.push({ token, addressId });
    }
    console.log(`[setup] ready — ${users.length} carts primed. Firing simultaneous POST /orders.\n`);
    return { users };
}

// ─── Main — one POST /orders per VU (the concurrency gate) ──────────────

export default function (data) {
    const u = data.users[(__VU - 1) % data.users.length];

    const start = Date.now();
    const res = http.post(
        `${API_BASE}/orders`,
        JSON.stringify({ shippingAddressId: u.addressId }),
        {
            headers: {
                ...authHeaders(u.token),
                "Idempotency-Key": `k6-conc-${__VU}-${Date.now()}`,
            },
        },
    );
    orderDuration.add(Date.now() - start);

    if (res.status === 201) {
        ordersCreated.add(1);
    } else if (res.status === 409 && res.json("error.code") === "INSUFFICIENT_STOCK") {
        ordersRejected.add(1);
    } else {
        ordersUnexpected.add(1);
        console.error(`VU ${__VU}: unexpected ${res.status} ${String(res.body).slice(0, 160)}`);
    }
}

// ─── Summary (k6-side counts; DB verification is in the orchestrator) ───

export function handleSummary(data) {
    const c = (k) => data.metrics[k]?.values?.count || 0;
    const created = c("orders_created");
    const rejected = c("orders_rejected");
    const unexpected = c("orders_unexpected");
    const p95 = Math.round(data.metrics.order_duration_ms?.values?.["p(95)"] || 0);

    console.log(
        `\n[inventory-concurrency] stock=${TARGET_STOCK} users=${USERS} ` +
            `created=${created} rejected=${rejected} unexpected=${unexpected} orderP95=${p95}ms\n`,
    );

    return {
        stdout: `created=${created} rejected=${rejected} unexpected=${unexpected}\n`,
        "k6/results/inventory-concurrency-k6.json": JSON.stringify(
            {
                timestamp: new Date().toISOString(),
                stock: TARGET_STOCK,
                users: USERS,
                created,
                rejected,
                unexpected,
                orderP95Ms: p95,
            },
            null,
            2,
        ),
    };
}
