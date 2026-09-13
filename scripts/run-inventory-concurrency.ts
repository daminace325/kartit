/**
 * Inventory concurrency benchmark orchestrator.
 *
 * Proves the advisory-lock inventory reservation prevents overselling:
 *   1. seeds the test SKU at physicalStock=STOCK, reservedQty=0
 *   2. fires USERS simultaneous checkouts via k6 (shared-iterations)
 *   3. verifies IN POSTGRES that exactly STOCK orders reserved stock and
 *      reservedQty never exceeded physicalStock (zero oversell)
 *
 * The API must be running with DISABLE_RATE_LIMITING=true (USERS signups from
 * one IP would otherwise be throttled by the auth limiter):
 *
 *   $env:DISABLE_RATE_LIMITING="true"; npm run dev:api
 *
 * Then, from the repo root:
 *
 *   npm run bench:inventory
 *   npm run bench:inventory -- --stock 10 --users 200
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { prisma, OrderStatus } from "@repo/db";

// ─── Config ────────────────────────────────────────────────────────────

const API_BASE = process.env.API_BASE_URL || "http://localhost:5000";
const TEST_SLUG = "concurrency-test-sku";

function argVal(flag: string, fallback: number): number {
    const i = process.argv.indexOf(flag);
    if (i !== -1 && process.argv[i + 1]) return Number(process.argv[i + 1]);
    return fallback;
}
const STOCK = argVal("--stock", 10);
const USERS = argVal("--users", 200);

// ─── Preflight ─────────────────────────────────────────────────────────

async function preflight(): Promise<void> {
    const res = await fetch(`${API_BASE}/health/live`).catch(() => null);
    if (!res || !res.ok) {
        console.error(
            `\n✗ API not reachable at ${API_BASE}. Start it with rate limiting off:\n` +
                '    $env:DISABLE_RATE_LIMITING="true"; npm run dev:api\n',
        );
        process.exit(1);
    }
    console.log(`  API reachable at ${API_BASE}.`);
    console.log("  NOTE: the API must run with DISABLE_RATE_LIMITING=true for this test.");
}

// ─── Seed the test SKU to a known stock ────────────────────────────────

async function seedSku(): Promise<void> {
    // The product needs a category. Reuse any existing one, or create a
    // fallback so the script also works on an unseeded catalog.
    const category =
        (await prisma.category.findFirst({ where: { isActive: true }, select: { id: true } })) ??
        (await prisma.category.create({
            data: { slug: "bench-electronics", name: "Bench Electronics" },
            select: { id: true },
        }));

    await prisma.product.upsert({
        where: { slug: TEST_SLUG },
        update: { physicalStock: STOCK, reservedQty: 0, isActive: true, deletedAt: null },
        create: {
            slug: TEST_SLUG,
            sku: "CTS-001",
            name: "Concurrency Test Product",
            description: "k6 inventory concurrency test SKU",
            priceMinor: 1999n,
            currency: "USD",
            physicalStock: STOCK,
            reservedQty: 0,
            isActive: true,
            categoryId: category.id,
        },
    });
    console.log(`  SKU "${TEST_SLUG}" seeded: physicalStock=${STOCK}, reservedQty=0.`);
}

// ─── Run k6 ────────────────────────────────────────────────────────────

function runK6(): void {
    execSync(
        `k6 run k6/inventory-concurrency.js ` +
            `-e API_BASE_URL=${API_BASE} -e USERS=${USERS} -e TARGET_STOCK=${STOCK} -e PRODUCT_SLUG=${TEST_SLUG}`,
        { stdio: "inherit" },
    );
}

// ─── Verify final DB state ─────────────────────────────────────────────

async function verify(runStart: Date) {
    const product = await prisma.product.findUniqueOrThrow({
        where: { slug: TEST_SLUG },
        select: { id: true, physicalStock: true, reservedQty: true },
    });

    // Orders created during this run that still hold a reservation for the SKU
    // (anything not CANCELLED/FAILED/REFUNDED keeps stock reserved).
    const ordersForSku = await prisma.order.count({
        where: {
            createdAt: { gte: runStart },
            status: { notIn: [OrderStatus.CANCELLED, OrderStatus.FAILED, OrderStatus.REFUNDED] },
            items: { some: { productId: product.id } },
        },
    });

    const oversold = product.reservedQty > product.physicalStock;
    const pass = product.reservedQty === STOCK && ordersForSku === STOCK && !oversold;

    const w = 54;
    const row = (a: string, b: string) => `│  ${a.padEnd(w - 4 - b.length)}${b}  │`;
    const lines = [
        "┌" + "─".repeat(w) + "┐",
        "│" + "  INVENTORY CONCURRENCY — OVERSELL CHECK".padEnd(w) + "│",
        "├" + "─".repeat(w) + "┤",
        row("Simultaneous buyers (VUs)", String(USERS)),
        row("Units in stock", String(STOCK)),
        row("Orders that reserved stock (DB)", String(ordersForSku)),
        row("Product.reservedQty (DB)", String(product.reservedQty)),
        row("Product.physicalStock (DB)", String(product.physicalStock)),
        row("Oversold?", oversold ? "YES" : "NO"),
        "├" + "─".repeat(w) + "┤",
        row("RESULT", pass ? "PASS" : "FAIL"),
        "└" + "─".repeat(w) + "┘",
    ];
    console.log("\n" + lines.join("\n") + "\n");

    writeFileSync(
        "k6/results/inventory-concurrency-summary.json",
        JSON.stringify(
            {
                timestamp: new Date().toISOString(),
                users: USERS,
                stock: STOCK,
                ordersReservedDb: ordersForSku,
                reservedQty: product.reservedQty,
                physicalStock: product.physicalStock,
                oversold,
                pass,
            },
            null,
            2,
        ),
    );
    console.log("Wrote k6/results/inventory-concurrency-summary.json");

    if (!pass) process.exitCode = 1;
}

// ─── Main ──────────────────────────────────────────────────────────────

async function main() {
    console.log("\nInventory concurrency benchmark — preflight...");
    await preflight();
    await seedSku();

    // 10s buffer guards against minor Node↔Postgres clock skew when filtering
    // this run's orders by createdAt. Prior runs' orders are minutes older.
    const runStart = new Date(Date.now() - 10_000);
    runK6();
    await verify(runStart);
}

main()
    .catch((err) => {
        console.error("\nBenchmark failed:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
