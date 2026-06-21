/**
 * k6 — Redis cache benchmark (read-heavy workload)
 *
 * Generates a realistic, read-heavy traffic mix with hot-key (Zipfian) skew
 * across the API's cached read surfaces. It does NOT compute the cache win
 * itself — the orchestrator (scripts/run-cache-benchmark.ts) runs this twice
 * (cache OFF vs ON) and reads server-side counters from /internal/metrics to
 * compute the DB-read reduction. This script's only job is to produce an
 * identical, deterministic load each run.
 *
 * Endpoints exercised (and the cache each one hits):
 *   GET  /products              → productListCache  (homepage "default")
 *   GET  /products/slug/:slug   → productCache
 *   GET  /categories            → categoryListCache
 *   GET  /categories/slug/:slug → categoryCache
 *   GET  /auth/me               → userCache (via requireAuth middleware)
 *   POST /cart/summary + promo  → promotionCache (note: validate() also runs
 *                                 2 uncached order.count queries by design)
 *
 * Prerequisites:
 *   - API running with EXPOSE_TEST_METRICS=true and DISABLE_RATE_LIMITING=true
 *   - Catalog seeded (npm run db:seed) and a promo code present
 *   These are handled for you by: npm run bench:cache
 *
 * Standalone usage:
 *   k6 run k6/cache-benchmark.js -e VUS=50 -e ITERATIONS=6000 -e PHASE=cached
 */

import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";

// ─── Config ────────────────────────────────────────────────────────────

const API_BASE = __ENV.API_BASE_URL || "http://localhost:5000";
const VUS = Number(__ENV.VUS) || 50;
const ITERATIONS = Number(__ENV.ITERATIONS) || 6000;
const PHASE = __ENV.PHASE || "run";
const TEST_USER_EMAIL = __ENV.TEST_USER_EMAIL || "damin@test.com";
const PASSWORD = __ENV.TEST_USER_PASSWORD || "damin123";
const PROMO_CODE = __ENV.PROMO_CODE || "BENCH10";

// ─── Custom metrics — one counter per endpoint bucket ──────────────────

const listProductsCount = new Counter("req_list_products");
const productDetailCount = new Counter("req_product_detail");
const listCategoriesCount = new Counter("req_list_categories");
const categoryDetailCount = new Counter("req_category_detail");
const authMeCount = new Counter("req_auth_me");
const cartSummaryCount = new Counter("req_cart_summary");
const errorCount = new Counter("req_errors");

// ─── Scenario: fixed total iterations (identical workload each phase) ──

export const options = {
    scenarios: {
        cache_load: {
            executor: "shared-iterations",
            vus: VUS,
            iterations: ITERATIONS,
            maxDuration: "10m",
        },
    },
    thresholds: {
        // Keep us honest: the read mix should essentially never error.
        req_errors: ["count<" + Math.ceil(ITERATIONS * 0.02)],
    },
    summaryTrendStats: ["min", "avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

// ─── Helpers ───────────────────────────────────────────────────────────

function extractCookie(res, name) {
    const setCookie = res.headers["Set-Cookie"];
    if (!setCookie) return null;
    const match = setCookie.match(new RegExp(`${name}=([^;]+)`));
    return match ? match[1] : null;
}

/**
 * Zipf-ish hot-key index: cubing a uniform [0,1) biases strongly toward 0,
 * so the first few slugs act as "popular" items — exactly the access skew
 * a real catalog sees, and the pattern caches are designed to exploit.
 */
function hotIndex(n) {
    const i = Math.floor(Math.pow(Math.random(), 3) * n);
    return i >= n ? n - 1 : i;
}

function publicHeaders() {
    return { "Content-Type": "application/json" };
}

function authHeaders(token) {
    return {
        "Content-Type": "application/json",
        Cookie: `ecomm_auth=${token}`,
        "X-Requested-With": "fetch",
    };
}

// ─── Setup (once): sign in, gather slugs, prime the cart ───────────────

export function setup() {
    console.log(`\n[setup] (${PHASE}) signing in as ${TEST_USER_EMAIL}...`);
    const signin = http.post(
        `${API_BASE}/auth/signin`,
        JSON.stringify({ email: TEST_USER_EMAIL, password: PASSWORD }),
        { headers: { "Content-Type": "application/json", "X-Requested-With": "fetch" } },
    );
    if (signin.status !== 200) {
        throw new Error(
            `signin failed: ${signin.status} — run 'npm run db:seed'. body=${signin.body}`,
        );
    }
    const token = extractCookie(signin, "ecomm_auth");
    if (!token) throw new Error("no auth cookie set on signin");

    console.log("[setup] fetching product slugs...");
    const products = http.get(`${API_BASE}/products?limit=50`);
    if (products.status !== 200) {
        throw new Error(`product list failed: ${products.status}`);
    }
    const productSlugs = (products.json("items") || []).map((p) => p.slug);
    if (productSlugs.length === 0) throw new Error("no products — run 'npm run db:seed'");

    console.log("[setup] fetching category slugs...");
    const categories = http.get(`${API_BASE}/categories`);
    if (categories.status !== 200) {
        throw new Error(`category list failed: ${categories.status}`);
    }
    // GET /categories returns { categories: [...] }
    const categorySlugs = (categories.json("categories") || []).map((c) => c.slug).filter(Boolean);
    if (categorySlugs.length === 0) throw new Error("no categories — run 'npm run db:seed'");

    // Prime the cart with one item so POST /cart/summary has a subtotal to
    // price (and therefore validates the promo code → promotionCache).
    const firstProduct = products.json("items.0");
    const addItem = http.post(
        `${API_BASE}/cart/items`,
        JSON.stringify({ productId: firstProduct.id, quantity: 1 }),
        { headers: authHeaders(token) },
    );
    if (addItem.status !== 201 && addItem.status !== 200) {
        console.warn(`[setup] cart add returned ${addItem.status} — /cart/summary slice may no-op`);
    }

    console.log(
        `[setup] ready — ${productSlugs.length} products, ${categorySlugs.length} categories. ` +
            `Firing ${ITERATIONS} requests over ${VUS} VUs.\n`,
    );
    return { token, productSlugs, categorySlugs };
}

// ─── Main — weighted read mix per iteration ────────────────────────────

export default function (data) {
    const r = Math.random();

    if (r < 0.35) {
        // Homepage listing — bare GET /products (limit defaults to 20 → cached).
        const res = http.get(`${API_BASE}/products`, { headers: publicHeaders() });
        check(res, { "list products 200": (x) => x.status === 200 }) || errorCount.add(1);
        listProductsCount.add(1);
    } else if (r < 0.65) {
        const slug = data.productSlugs[hotIndex(data.productSlugs.length)];
        const res = http.get(`${API_BASE}/products/slug/${slug}`, { headers: publicHeaders() });
        check(res, { "product detail 200": (x) => x.status === 200 }) || errorCount.add(1);
        productDetailCount.add(1);
    } else if (r < 0.80) {
        const res = http.get(`${API_BASE}/categories`, { headers: publicHeaders() });
        check(res, { "list categories 200": (x) => x.status === 200 }) || errorCount.add(1);
        listCategoriesCount.add(1);
    } else if (r < 0.90) {
        const slug = data.categorySlugs[hotIndex(data.categorySlugs.length)];
        const res = http.get(`${API_BASE}/categories/slug/${slug}`, { headers: publicHeaders() });
        check(res, { "category detail 200": (x) => x.status === 200 }) || errorCount.add(1);
        categoryDetailCount.add(1);
    } else if (r < 0.95) {
        const res = http.get(`${API_BASE}/auth/me`, { headers: authHeaders(data.token) });
        check(res, { "auth me 200": (x) => x.status === 200 }) || errorCount.add(1);
        authMeCount.add(1);
    } else {
        const res = http.post(
            `${API_BASE}/cart/summary`,
            JSON.stringify({ promotionCode: PROMO_CODE }),
            { headers: authHeaders(data.token) },
        );
        check(res, { "cart summary 200": (x) => x.status === 200 }) || errorCount.add(1);
        cartSummaryCount.add(1);
    }
}

// ─── Summary — write per-phase request distribution ────────────────────

export function handleSummary(data) {
    const m = data.metrics;
    const count = (k) => m[k]?.values?.count || 0;

    const buckets = {
        listProducts: count("req_list_products"),
        productDetail: count("req_product_detail"),
        listCategories: count("req_list_categories"),
        categoryDetail: count("req_category_detail"),
        authMe: count("req_auth_me"),
        cartSummary: count("req_cart_summary"),
    };
    const total = Object.values(buckets).reduce((a, b) => a + b, 0);
    const errors = count("req_errors");

    console.log(
        `\n[${PHASE}] requests=${total} errors=${errors} ` +
            `list=${buckets.listProducts} detail=${buckets.productDetail} ` +
            `cats=${buckets.listCategories} catDetail=${buckets.categoryDetail} ` +
            `me=${buckets.authMe} summary=${buckets.cartSummary}\n`,
    );

    return {
        stdout: `phase=${PHASE} requests=${total} errors=${errors}\n`,
        [`k6/results/cache-benchmark-${PHASE}.json`]: JSON.stringify(
            { timestamp: new Date().toISOString(), phase: PHASE, vus: VUS, iterations: ITERATIONS, buckets, total, errors },
            null,
            2,
        ),
    };
}
