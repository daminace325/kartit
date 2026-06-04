/**
 * Cleanup script — removes all k6 test data and resets product stock.
 *
 * Run after k6 load tests to restore the database to a clean seed state:
 *   npx tsx scripts/cleanup-k6.ts
 *
 * What it does:
 *   1. Deletes all k6 test artifacts in FK-safe order (idempotency keys →
 *      payments → order items → refund requests → outbox/ledger entries →
 *      orders → cart items → carts → addresses → users).
 *   2. Resets all product stock (physicalStock → 25, reservedQty → 0).
 *
 * Idempotent: safe to run multiple times — no k6 data → nothing happens.
 */

import { prisma } from "@repo/db";

const K6_EMAIL_PREFIX = "k6-";

async function main() {
  console.log("Cleaning up k6 test data...\n");

  // ── Resolve k6 user & order IDs ────────────────────────────────────

  const k6Users = await prisma.user.findMany({
    where: { email: { startsWith: K6_EMAIL_PREFIX } },
    select: { id: true },
  });
  const k6UserIds = k6Users.map((u) => u.id);

  if (k6UserIds.length === 0) {
    console.log("  No k6 test data found — nothing to clean up.");
    console.log("  Resetting product stock anyway...");
    const reset = await prisma.$executeRawUnsafe(
      `UPDATE "Product" SET "physicalStock" = 25, "reservedQty" = 0`,
    );
    console.log(`  Product stock reset: ${reset} rows\n`);
    console.log("Done.");
    await prisma.$disconnect();
    return;
  }

  console.log(`  Found ${k6Users.length} k6 test user(s)\n`);

  // Cache order IDs before we start deleting
  const k6Orders = await prisma.order.findMany({
    where: { userId: { in: k6UserIds } },
    select: { id: true },
  });
  const k6OrderIds = k6Orders.map((o) => o.id);

  // ── 1. Delete IdempotencyKeys (no FK constraint) ──────────────────

  const deletedIdemKeys = await prisma.idempotencyKey.deleteMany({
    where: { userId: { in: k6UserIds } },
  });
  console.log(`  IdempotencyKeys:  ${deletedIdemKeys.count}`);

  // ── 2. Delete Payments ────────────────────────────────────────────

  if (k6OrderIds.length > 0) {
    const deletedPayments = await prisma.payment.deleteMany({
      where: { orderId: { in: k6OrderIds } },
    });
    console.log(`  Payments:         ${deletedPayments.count}`);

    // ── 3. Delete OrderItems ──────────────────────────────────────────

    const deletedOrderItems = await prisma.orderItem.deleteMany({
      where: { orderId: { in: k6OrderIds } },
    });
    console.log(`  OrderItems:       ${deletedOrderItems.count}`);

    // ── 4. Delete RefundRequests ─────────────────────────────────────

    const deletedRefunds = await prisma.refundRequest.deleteMany({
      where: {
        OR: [
          { orderId: { in: k6OrderIds } },
          { userId: { in: k6UserIds } },
        ],
      },
    });
    console.log(`  RefundRequests:   ${deletedRefunds.count}`);

    // ── 5. Clean up Outbox & Ledger (plain string refs, no FK) ──────

    await prisma.$executeRawUnsafe(
      `DELETE FROM "Outbox" WHERE "aggregateId" IN (SELECT id FROM "Order" WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE '${K6_EMAIL_PREFIX}%'))`,
    );
    await prisma.$executeRawUnsafe(
      `DELETE FROM "LedgerEntry" WHERE "orderId" IN (SELECT id FROM "Order" WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE '${K6_EMAIL_PREFIX}%'))`,
    );
    console.log(`  Outbox/Ledger:    cleaned`);
  }

  // ── 6. Delete Orders (User→Order has no onDelete cascade) ─────────

  const deletedOrders = await prisma.order.deleteMany({
    where: { userId: { in: k6UserIds } },
  });
  console.log(`  Orders:           ${deletedOrders.count}`);

  // ── 7. Delete CartItems (via Cart relation) ───────────────────────

  const deletedCartItems = await prisma.cartItem.deleteMany({
    where: { cart: { userId: { in: k6UserIds } } },
  });
  console.log(`  CartItems:        ${deletedCartItems.count}`);

  // ── 8. Delete Carts ───────────────────────────────────────────────

  const deletedCarts = await prisma.cart.deleteMany({
    where: { userId: { in: k6UserIds } },
  });
  console.log(`  Carts:            ${deletedCarts.count}`);

  // ── 9. Delete Addresses (Cascade on FK, explicit for clarity) ─────

  const deletedAddresses = await prisma.address.deleteMany({
    where: { userId: { in: k6UserIds } },
  });
  console.log(`  Addresses:        ${deletedAddresses.count}`);

  // ── 10. Delete Users ──────────────────────────────────────────────

  const deletedUsers = await prisma.user.deleteMany({
    where: { email: { startsWith: K6_EMAIL_PREFIX } },
  });
  console.log(`  Users:            ${deletedUsers.count}`);

  // ── 11. Reset product stock ───────────────────────────────────────

  const stockReset = await prisma.$executeRawUnsafe(
    `UPDATE "Product" SET "physicalStock" = 25, "reservedQty" = 0`,
  );
  console.log(`\n  Product stock → 25, reservedQty → 0   (${stockReset} rows)`);

  console.log("\nDone — database is back to seed state.");
}

main()
  .catch((err) => {
    console.error("Cleanup failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
