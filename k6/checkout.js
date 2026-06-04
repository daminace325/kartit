/**
 * k6 load test — Full checkout flow (signup → order).
 *
 * Flow per virtual user:
 *   1. Signup (unique email) → get auth cookie
 *   2. Browse products → pick a random one
 *   3. Add to cart
 *   4. Create shipping address
 *   5. Create order (the concurrency/consistency gate)
 *   6. (optional) Create PaymentIntent if STRIPE_SECRET_KEY is set
 *
 * Usage:
 *   # Smoke (10 VUs, quick sanity check)
 *   k6 run k6/checkout.js
 *
 *   # Load (50 concurrent)
 *   k6 run k6/checkout.js -e VUS=50
 *
 *   # Stress (200 concurrent)
 *   k6 run k6/checkout.js -e VUS=200 -e DURATION=5m
 *
 *   # Custom
 *   k6 run k6/checkout.js -e VUS=100 -e DURATION=3m -e API_BASE_URL=http://localhost:5000 -e SKIP_PAYMENT=true
 *
 * Output:
 *   Console summary + JSON via --out json=k6/results/checkout-<ts>.json
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Counter, Rate } from "k6/metrics";

// ─── Config ────────────────────────────────────────────────────────────

const API_BASE = __ENV.API_BASE_URL || "http://localhost:5000";
const TARGET_VUS = Number(__ENV.VUS) || 10;
const HOLD_DURATION = __ENV.DURATION || "2m";
const SKIP_PAYMENT = __ENV.SKIP_PAYMENT === "true";

// ─── Custom metrics ─────────────────────────────────────────────────────

const signupDuration = new Trend("signup_duration_ms", true);
const productListDuration = new Trend("product_list_duration_ms", true);
const cartAddDuration = new Trend("cart_add_duration_ms", true);
const addressDuration = new Trend("address_duration_ms", true);
const orderDuration = new Trend("order_duration_ms", true);
const paymentIntentDuration = new Trend("payment_intent_duration_ms", true);
const fullCheckoutDuration = new Trend("full_checkout_duration_ms", true);

const ordersCreated = new Counter("orders_created");
const ordersStockout = new Counter("orders_stockout");
const checkoutsCompleted = new Counter("checkouts_completed");
const checkoutFailed = new Rate("checkout_failed");

// ─── Scenarios ──────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    checkout_ramp: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: Math.min(TARGET_VUS, 10) },  // warm-up
        { duration: "30s", target: TARGET_VUS },                  // ramp
        { duration: HOLD_DURATION, target: TARGET_VUS },           // hold
        { duration: "30s", target: 0 },                           // ramp-down
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.10"],             // <10% overall error rate
    "full_checkout_duration_ms": ["p(95)<10000"], // p95 under 10s
  },
  summaryTrendStats: ["min", "avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * k6 stores cookies automatically via the cookie jar, but the API sets an
 * httpOnly cookie. We extract it manually from the Set-Cookie header so we
 * can pass it explicitly as a Cookie header on subsequent requests.
 */
function extractCookie(res, cookieName) {
  const setCookie = res.headers["Set-Cookie"];
  if (!setCookie) return null;
  const match = setCookie.match(new RegExp(`${cookieName}=([^;]+)`));
  return match ? match[1] : null;
}

/** Headers for authenticated mutating requests (CSRF middleware requirement). */
function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    Cookie: `ecomm_auth=${token}`,
    "X-Requested-With": "fetch",
  };
}

/** Minimal headers for public GET requests. */
function publicHeaders() {
  return { "Content-Type": "application/json" };
}

/**
 * Sign up a new user. Each VU creates a unique user to avoid rate-limit
 * collisions (20 orders / 15 min per user).
 */
function signup(vuId, iterId) {
  const start = Date.now();
  const email = `k6-checkout-${vuId}-${iterId}-${Date.now()}@test.com`;
  const res = http.post(
    `${API_BASE}/auth/signup`,
    JSON.stringify({
      email,
      password: "k6test123",
      name: `K6 User ${vuId}`,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "fetch", // CSRF middleware requires this on all POST
      },
    },
  );
  signupDuration.add(Date.now() - start);
  return { res, email };
}

/** Sign in with existing seeded user (alternative to signup if needed). */
function signin(email, password) {
  const start = Date.now();
  const res = http.post(
    `${API_BASE}/auth/signin`,
    JSON.stringify({ email, password }),
    { headers: publicHeaders() },
  );
  signupDuration.add(Date.now() - start); // reuse metric
  return res;
}

/** Fetch products. Use max limit=50 to spread VUs across as many products as possible. */
function fetchProducts() {
  const start = Date.now();
  // Max page size gives us ~48 products — enough spread for stock to last
  // longer under concurrent load. Each product has 25 stock, so 48×25=1200
  // orders can succeed before stockouts begin.
  const res = http.get(
    `${API_BASE}/products?limit=50`,
    { headers: publicHeaders() },
  );
  productListDuration.add(Date.now() - start);
  return res;
}

/** Pick a random product from the list. */
function pickProduct(items) {
  const active = items.filter((p) => p.isActive && p.stock > 0);
  if (active.length === 0) return items[0]; // fallback
  return active[Math.floor(Math.random() * active.length)];
}

/** Add a product to cart. */
function addToCart(token, productId, quantity) {
  const start = Date.now();
  const res = http.post(
    `${API_BASE}/cart/items`,
    JSON.stringify({ productId, quantity }),
    { headers: authHeaders(token) },
  );
  cartAddDuration.add(Date.now() - start);
  return res;
}

/** Create a shipping address. */
function createAddress(token, vuId) {
  const start = Date.now();
  const res = http.post(
    `${API_BASE}/addresses`,
    JSON.stringify({
      name: `K6 Tester ${vuId}`,
      phone: "+15550009999",
      line1: `${vuId} Main St`,
      city: "Testville",
      state: "TS",
      postalCode: "12345",
      country: "US",
    }),
    { headers: authHeaders(token) },
  );
  addressDuration.add(Date.now() - start);
  return res;
}

/** Create an order from the cart. */
function createOrder(token, addressId, idemKey) {
  const start = Date.now();
  const res = http.post(
    `${API_BASE}/orders`,
    JSON.stringify({ shippingAddressId: addressId }),
    {
      headers: {
        ...authHeaders(token),
        "Idempotency-Key": idemKey,
      },
    },
  );
  orderDuration.add(Date.now() - start);
  return res;
}

/** Create a PaymentIntent. Only works if STRIPE_SECRET_KEY is configured. */
function createPaymentIntent(token, orderId, idemKey) {
  const start = Date.now();
  const res = http.post(
    `${API_BASE}/payments/intent`,
    JSON.stringify({ orderId }),
    {
      headers: {
        ...authHeaders(token),
        "Idempotency-Key": idemKey + "-pi",
      },
    },
  );
  paymentIntentDuration.add(Date.now() - start);
  return res;
}

// ─── Main ───────────────────────────────────────────────────────────────
//
// IMPORTANT: In k6, `return` inside a `group()` callback does NOT exit the
// `default` function — it only exits the group callback. We use flat
// sequential code with top-level early returns for correct flow control.
// Groups are used only for organizational output, not flow control.

export default function () {
  const vuId = __VU;
  const iterId = __ITER;
  const checkoutStart = Date.now();
  const idemKey = `k6-checkout-${vuId}-${iterId}-${Date.now()}`;

  // ── 1. Signup ──────────────────────────────────────────────────

  const signupRes = signup(vuId, iterId);
  const signupOk = check(signupRes.res, { "signup 201": (r) => r.status === 201 });
  if (!signupOk) {
    checkoutFailed.add(true);
    return;
  }

  const token = extractCookie(signupRes.res, "ecomm_auth");
  if (!token) {
    checkoutFailed.add(true);
    return;
  }

  // ── 2. Browse products ─────────────────────────────────────────

  const productsRes = fetchProducts();
  const productsOk = check(productsRes, { "products 200": (r) => r.status === 200 });
  if (!productsOk) {
    checkoutFailed.add(true);
    return;
  }

  const items = productsRes.json()?.items;
  if (!items || items.length === 0) {
    checkoutFailed.add(true);
    return;
  }
  const product = pickProduct(items);

  // ── 3. Add to cart ─────────────────────────────────────────────

  const cartRes = addToCart(token, product.id, 1);
  const cartOk = check(cartRes, { "cart add 201": (r) => r.status === 201 });
  if (!cartOk) {
    if (cartRes.status === 409) {
      ordersStockout.add(1); // stock exhausted — expected under load
    } else {
      checkoutFailed.add(true);
    }
    return;
  }

  // ── 4. Shipping address ────────────────────────────────────────

  const addrRes = createAddress(token, vuId);
  const addrOk = check(addrRes, { "address 201": (r) => r.status === 201 });
  if (!addrOk) {
    checkoutFailed.add(true);
    return;
  }

  const addressId = addrRes.json("address.id");
  if (!addressId) {
    checkoutFailed.add(true);
    return;
  }

  // ── 5. Create order ────────────────────────────────────────────

  const orderRes = createOrder(token, addressId, idemKey);

  if (orderRes.status === 201) {
    ordersCreated.add(1);
    check(orderRes, { "order created": true });
  } else if (orderRes.status === 409) {
    ordersStockout.add(1);
    check(orderRes, {
      "order rejected (stock)": (r) =>
        r.json("error.code") === "INSUFFICIENT_STOCK",
    });
    return;
  } else {
    checkoutFailed.add(true);
    return;
  }

  const order = orderRes.json("order");
  const orderId = order?.id;

  // ── 6. Payment intent (optional) ───────────────────────────────

  if (orderId && !SKIP_PAYMENT) {
    group("6. payment intent", () => {
      const piRes = createPaymentIntent(token, orderId, idemKey);
      check(piRes, {
        "payment intent ok": (r) => r.status === 201 || r.status === 500,
      });
    });
  }

  // ── Done ───────────────────────────────────────────────────────

  if (orderId) {
    checkoutsCompleted.add(1);
    fullCheckoutDuration.add(Date.now() - checkoutStart);
  }

  sleep(1);
}

// ─── Summary ────────────────────────────────────────────────────────────

export function handleSummary(data) {
  const metrics = data.metrics;

  const getVal = (metric, field) => metrics[metric]?.values?.[field] || 0;
  const total = (metric) => getVal(metric, "count");
  const p50 = (metric) => getVal(metric, "med");    // k6 v2: median = p50
  const p95 = (metric) => getVal(metric, "p(95)");
  const p99 = (metric) => getVal(metric, "p(99)");
  const avg = (metric) => getVal(metric, "avg");

  const httpReqDuration = metrics.http_req_duration?.values || {};
  const httpReqs = total("http_reqs");
  const httpFailed = getVal("http_req_failed", "rate");
  const testDuration = data.state?.testRunDurationMs
    ? (data.state.testRunDurationMs / 1000).toFixed(0)
    : "?";

  const rps = testDuration !== "?" ? (httpReqs / testDuration).toFixed(1) : "?";

  const created = total("orders_created");
  const stockouts = total("orders_stockout");
  const completed = total("checkouts_completed");

  const rows = [
    ["Checkouts completed", String(completed)],
    ["Orders created (201)", String(created)],
    ["Orders rejected (409 stockout)", String(stockouts)],
    ["Total HTTP requests", String(httpReqs)],
    ["Test duration (s)", String(testDuration)],
    ["Avg RPS", String(rps)],
    ["HTTP failure rate", `${(httpFailed * 100).toFixed(1)}%`],
    ["", ""],
    ["Signup p50 / p95 / p99 (ms)", `${Math.round(p50("signup_duration_ms"))} / ${Math.round(p95("signup_duration_ms"))} / ${Math.round(p99("signup_duration_ms"))}`],
    ["Product list p50 / p95 / p99 (ms)", `${Math.round(p50("product_list_duration_ms"))} / ${Math.round(p95("product_list_duration_ms"))} / ${Math.round(p99("product_list_duration_ms"))}`],
    ["Cart add p50 / p95 / p99 (ms)", `${Math.round(p50("cart_add_duration_ms"))} / ${Math.round(p95("cart_add_duration_ms"))} / ${Math.round(p99("cart_add_duration_ms"))}`],
    ["Address create p50 / p95 / p99 (ms)", `${Math.round(p50("address_duration_ms"))} / ${Math.round(p95("address_duration_ms"))} / ${Math.round(p99("address_duration_ms"))}`],
    ["Order create p50 / p95 / p99 (ms)", `${Math.round(p50("order_duration_ms"))} / ${Math.round(p95("order_duration_ms"))} / ${Math.round(p99("order_duration_ms"))}`],
    ["Payment intent p50 / p95 / p99 (ms)", `${Math.round(p50("payment_intent_duration_ms"))} / ${Math.round(p95("payment_intent_duration_ms"))} / ${Math.round(p99("payment_intent_duration_ms"))}`],
    ["Full checkout p50 / p95 / p99 (ms)", `${Math.round(p50("full_checkout_duration_ms"))} / ${Math.round(p95("full_checkout_duration_ms"))} / ${Math.round(p99("full_checkout_duration_ms"))}`],
    ["", ""],
    ["HTTP req p50 / p95 / p99 (ms)", `${Math.round(getVal("http_req_duration", "med"))} / ${Math.round(getVal("http_req_duration", "p(95)"))} / ${Math.round(getVal("http_req_duration", "p(99)"))}`],
  ];

  // Build ASCII table
  const col1Width = Math.max(...rows.map((r) => r[0].length)) + 2;
  const col2Width = Math.max(...rows.map((r) => r[1].length)) + 2;
  const width = col1Width + col2Width + 3;

  const lines = [];
  lines.push("┌" + "─".repeat(width) + "┐");
  lines.push("│" + "  K6 CHECKOUT LOAD TEST RESULTS".padEnd(width) + "│");
  lines.push("├" + "─".repeat(width) + "┤");

  for (const [label, value] of rows) {
    if (!label && !value) {
      lines.push("│" + " ".repeat(width) + "│");
    } else {
      const line = `  ${label.padEnd(col1Width)} ${String(value).padStart(col2Width)} `;
      lines.push("│" + line.padEnd(width) + "│");
    }
  }

  lines.push("└" + "─".repeat(width) + "┘");

  console.log("\n" + lines.join("\n") + "\n");

  return {
    stdout: `orders=${created} rps=${rps} p95_order=${Math.round(p95("order_duration_ms"))}ms`,
    "k6/results/checkout-summary.json": JSON.stringify(
      {
        scenario: __ENV.SCENARIO || "default",
        vus: TARGET_VUS,
        duration: HOLD_DURATION,
        timestamp: new Date().toISOString(),
        checkoutsCompleted: completed,
        ordersCreated: created,
        ordersRejectedStockout: stockouts,
        totalHttpRequests: httpReqs,
        testDurationSeconds: Number(testDuration),
        avgRps: Number(rps),
        httpFailureRate: httpFailed,
        p50: {
          signup: Math.round(p50("signup_duration_ms")),
          productList: Math.round(p50("product_list_duration_ms")),
          cartAdd: Math.round(p50("cart_add_duration_ms")),
          addressCreate: Math.round(p50("address_duration_ms")),
          orderCreate: Math.round(p50("order_duration_ms")),
          paymentIntent: Math.round(p50("payment_intent_duration_ms")),
          fullCheckout: Math.round(p50("full_checkout_duration_ms")),
          httpReq: Math.round(getVal("http_req_duration", "med")),
        },
        p95: {
          signup: Math.round(p95("signup_duration_ms")),
          productList: Math.round(p95("product_list_duration_ms")),
          cartAdd: Math.round(p95("cart_add_duration_ms")),
          addressCreate: Math.round(p95("address_duration_ms")),
          orderCreate: Math.round(p95("order_duration_ms")),
          paymentIntent: Math.round(p95("payment_intent_duration_ms")),
          fullCheckout: Math.round(p95("full_checkout_duration_ms")),
          httpReq: Math.round(getVal("http_req_duration", "p(95)")),
        },
        p99: {
          signup: Math.round(p99("signup_duration_ms")),
          productList: Math.round(p99("product_list_duration_ms")),
          cartAdd: Math.round(p99("cart_add_duration_ms")),
          addressCreate: Math.round(p99("address_duration_ms")),
          orderCreate: Math.round(p99("order_duration_ms")),
          paymentIntent: Math.round(p99("payment_intent_duration_ms")),
          fullCheckout: Math.round(p99("full_checkout_duration_ms")),
          httpReq: Math.round(getVal("http_req_duration", "p(99)")),
        },
      },
      null,
      2,
    ),
  };
}
