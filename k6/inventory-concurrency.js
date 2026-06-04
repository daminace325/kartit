/**
 * k6 concurrency test — Inventory safety under concurrent checkout (P2.7).
 *
 * Strategy:
 *   1. One product with physicalStock = 10 is created before the test.
 *   2. 200 virtual users each sign up → add a shipping address → add the
 *      product to cart → POST /orders.
 *   3. The advisory lock inside the order-create transaction guarantees
 *      serialised access per product — exactly 10 orders succeed (201) and
 *      190 fail with 409 (INSUFFICIENT_STOCK).
 *
 * Prerequisites:
 *   - API running at API_BASE_URL (default http://localhost:5000)
 *   - A product with slug `concurrency-test-sku` and physicalStock = 10.
 *     Create it via admin or seed before running:
 *       curl -X POST http://localhost:5000/products \
 *         -H "Content-Type: application/json" \
 *         -d '{"slug":"concurrency-test-sku","sku":"CTS-001","name":"Concurrency Test Product","description":"k6 concurrency test","priceMinor":1999,"currency":"USD","physicalStock":10,"isActive":true,"categoryId":"<id>"}'
 *
 * Usage:
 *   k6 run k6/inventory-concurrency.js
 *
 *   With custom API URL:
 *   k6 run -e API_BASE_URL=http://localhost:5000 k6/inventory-concurrency.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

// ─── Config ────────────────────────────────────────────────────────────

const API_BASE = __ENV.API_BASE_URL || "http://localhost:5000";
const PRODUCT_SLUG = __ENV.PRODUCT_SLUG || "concurrency-test-sku";
const CONCURRENT_USERS = 200;
const TARGET_STOCK = 10;

// ─── Custom metrics ─────────────────────────────────────────────────────

const ordersCreated = new Counter("orders_created");
const ordersRejected = new Counter("orders_rejected");
const orderDuration = new Trend("order_duration_ms");

export const options = {
    scenarios: {
        checkout_surge: {
            executor: "ramping-vus",
            startVUs: 0,
            stages: [
                { duration: "2s", target: CONCURRENT_USERS },  // ramp-up
                { duration: "10s", target: CONCURRENT_USERS }, // hold at 200
                { duration: "2s", target: 0 },                  // ramp-down
            ],
        },
    },
    thresholds: {
        orders_created: [`count === ${TARGET_STOCK}`], // exactly 10 succeed
    },
};

// ─── Helpers ────────────────────────────────────────────────────────────

function extractCookie(res, cookieName) {
  const setCookie = res.headers["Set-Cookie"];
  if (!setCookie) return null;
  const match = setCookie.match(new RegExp(`${cookieName}=([^;]+)`));
  return match ? match[1] : null;
}

function signup(vuId) {
    const email = `k6-concurrency-${vuId}-${Date.now()}@test.com`;
    const res = http.post(
        `${API_BASE}/auth/signup`,
        JSON.stringify({
            email,
            password: "k6test123",
            name: `K6 User ${vuId}`,
        }),
        { headers: { "Content-Type": "application/json", "X-Requested-With": "fetch" } },
    );
    return res;
}

function createAddress(token) {
    const res = http.post(
        `${API_BASE}/addresses`,
        JSON.stringify({
            name: "K6 Test",
            phone: "555-0001",
            line1: "123 Main St",
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
    return res;
}

function getProductBySlug() {
    return http.get(`${API_BASE}/products/slug/${PRODUCT_SLUG}`);
}

function addToCart(token, productId, quantity) {
    return http.post(
        `${API_BASE}/cart/items`,
        JSON.stringify({ productId, quantity }),
        {
            headers: {
                "Content-Type": "application/json",
                Cookie: `ecomm_auth=${token}`,
                "X-Requested-With": "fetch",
            },
        },
    );
}

function createOrder(token, addressId, idemKey) {
    const start = Date.now();
    const res = http.post(
        `${API_BASE}/orders`,
        JSON.stringify({ shippingAddressId: addressId }),
        {
            headers: {
                "Content-Type": "application/json",
                Cookie: `ecomm_auth=${token}`,
                "X-Requested-With": "fetch",
                "Idempotency-Key": idemKey,
            },
        },
    );
    orderDuration.add(Date.now() - start);
    return res;
}

// ─── Main ───────────────────────────────────────────────────────────────
//
// Flat sequential flow with top-level early returns — NOT wrapped in group()
// because `return` inside a k6 group callback only exits the group, not the
// default function.

export default function () {
    const vuId = __VU;
    const iterId = __ITER;
    const idemKey = `k6-concurrency-${vuId}-${iterId}-${Date.now()}`;

    // ── 1. Signup ──────────────────────────────────────────────────

    const signupRes = signup(`${vuId}-${iterId}`);
    const signupOk = check(signupRes, { "signup 201": (r) => r.status === 201 });
    if (!signupOk) return;

    const token = extractCookie(signupRes, "ecomm_auth");
    if (!token) return;

    // ── 2. Create shipping address ──────────────────────────────────

    const addrRes = createAddress(token);
    const addrOk = check(addrRes, { "address 201": (r) => r.status === 201 });
    if (!addrOk) return;

    const addressId = addrRes.json("address.id");
    if (!addressId) return;

    // ── 3. Get product ──────────────────────────────────────────────

    const productRes = getProductBySlug();
    const productOk = check(productRes, { "product 200": (r) => r.status === 200 });
    if (!productOk) return;

    const productId = productRes.json("product.id");
    if (!productId) return;

    // ── 4. Add to cart ──────────────────────────────────────────────

    const cartRes = addToCart(token, productId, 1);
    const cartOk = check(cartRes, { "cart add 201": (r) => r.status === 201 });
    if (!cartOk) return;

    // ── 5. Create order — the concurrency gate ──────────────────────

    const orderRes = createOrder(token, addressId, idemKey);

    if (orderRes.status === 201) {
        ordersCreated.add(1);
        check(orderRes, { "order created": true });
    } else if (orderRes.status === 409) {
        ordersRejected.add(1);
        check(orderRes, {
            "order rejected (insufficient stock)": (r) =>
                r.json("error.code") === "INSUFFICIENT_STOCK",
        });
    } else {
        console.error(
            `Unexpected order status ${orderRes.status}: ${orderRes.body}`,
        );
    }

    sleep(0.1);
}

// ─── Teardown summary ──────────────────────────────────────────────────

export function handleSummary(data) {
    const created = data.metrics.orders_created?.values?.count || 0;
    const rejected = data.metrics.orders_rejected?.values?.count || 0;
    const p95 = data.metrics.order_duration_ms?.values?.["p(95)"] || 0;
    const p99 = data.metrics.order_duration_ms?.values?.["p(99)"] || 0;

    console.log("");
    console.log("╔══════════════════════════════════════════════╗");
    console.log("║  Inventory Concurrency Test Results          ║");
    console.log("╠══════════════════════════════════════════════╣");
    console.log(`║  Target stock:       ${String(TARGET_STOCK).padStart(6)}                    ║`);
    console.log(`║  Concurrent users:   ${String(CONCURRENT_USERS).padStart(6)}                    ║`);
    console.log(`║  Orders created:     ${String(created).padStart(6)}                    ║`);
    console.log(`║  Orders rejected:    ${String(rejected).padStart(6)}                    ║`);
    console.log(`║  Order duration p95: ${String(Math.round(p95)).padStart(6)} ms                ║`);
    console.log(`║  Order duration p99: ${String(Math.round(p99)).padStart(6)} ms                ║`);
    console.log("╚══════════════════════════════════════════════╝");

    const passed = created === TARGET_STOCK;
    console.log(passed ? "✅ PASS: Exactly 10 orders succeeded." : `❌ FAIL: Expected ${TARGET_STOCK}, got ${created}.`);

    return {
        stdout: passed
            ? "PASS: inventory-concurrency"
            : "FAIL: inventory-concurrency",
    };
}
