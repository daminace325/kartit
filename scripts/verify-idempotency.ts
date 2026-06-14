/**
 * Verify the outcome of k6/idempotency-stress.js.
 *
 * Reads orders for the test user from Postgres and asserts:
 *   • Exactly 1 order exists (proves idempotency prevented duplicates)
 *   • Exit code 0 on pass, 1 on fail
 *
 * Usage:
 *   npm run verify:idem
 *   TEST_USER_EMAIL=k6-seed-5@test.com npx tsx scripts/verify-idempotency.ts
 */

import { prisma } from "@repo/db";

const TEST_EMAIL = process.env.TEST_USER_EMAIL || "k6-seed-0@test.com";

async function main() {
    console.log(`\nVerifying idempotency outcome for user: ${TEST_EMAIL}\n`);

    const user = await prisma.user.findUnique({
        where: { email: TEST_EMAIL },
        select: { id: true, email: true },
    });

    if (!user) {
        console.error(
            `✗ Test user ${TEST_EMAIL} not found. Did you run 'npm run seed:k6'?`,
        );
        process.exit(1);
    }

    const orders = await prisma.order.findMany({
        where: { userId: user.id },
        select: {
            id: true,
            orderNumber: true,
            status: true,
            totalMinor: true,
            createdAt: true,
        },
        orderBy: { createdAt: "asc" },
    });

    console.log(`Found ${orders.length} order(s) for ${user.email}:\n`);
    for (const o of orders) {
        const total = `$${(Number(o.totalMinor) / 100).toFixed(2)}`;
        console.log(
            `  ${o.orderNumber}  ${o.status.padEnd(10)}  ${total.padStart(10)}  ${o.createdAt.toISOString()}`,
        );
    }
    console.log();

    if (orders.length === 1) {
        console.log(
            "✓ PASS — exactly 1 order created. Idempotency is preventing duplicates correctly.",
        );
        process.exit(0);
    }

    if (orders.length === 0) {
        console.log(
            "✗ FAIL — no orders created. The test did not run, or every request failed.",
        );
        console.log(
            "        Check the API is up and DISABLE_RATE_LIMITING=true is set.",
        );
        process.exit(1);
    }

    console.log(
        `✗ FAIL — ${orders.length} orders created. Idempotency is NOT preventing duplicates.`,
    );
    console.log(
        "         Investigate the middleware in apps/api/src/middlewares/idempotency.ts",
    );
    process.exit(1);
}

main()
    .catch((err) => {
        console.error("Verify failed:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
