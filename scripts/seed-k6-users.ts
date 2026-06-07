/**
 * Pre-seed users for k6 load tests — bypasses argon2 by hashing once and
 * reusing the hash across all seed users. This avoids the signup bottleneck
 * during load testing so checkouts focus on the real e-commerce flow.
 *
 * Usage:
 *   npx tsx scripts/seed-k6-users.ts [count]
 *
 *   # Default (2000 users — enough for 200 VUs × ~10 iterations each)
 *   npx tsx scripts/seed-k6-users.ts
 *
 *   # Custom count (match your VU × expected iterations)
 *   npx tsx scripts/seed-k6-users.ts 5000
 *
 *   # Minimal (smoke test with 10 VUs)
 *   npx tsx scripts/seed-k6-users.ts 50
 *
 * All users share the same password ("k6test123") and follow the naming
 * scheme: k6-seed-0@test.com … k6-seed-{N-1}@test.com.
 *
 * Idempotent: deletes any existing k6-seed users (FK-safe order) before
 * creating new ones so repeated runs produce a clean slate.
 */

import { prisma } from "@repo/db";
import argon2 from "argon2";

const COUNT = Math.max(1, Number(process.argv[2]) || 2000);
const PASSWORD = "k6test123";
const EMAIL_PREFIX = "k6-seed-";
const BATCH_SIZE = 200;

async function main() {
  console.log(`Seeding ${COUNT} k6 test users (password: "${PASSWORD}")…\n`);

  // ── Hash once ────────────────────────────────────────────────────
  console.log("  Hashing password (one-time argon2 cost)…");
  const hashStart = Date.now();
  const hash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  console.log(`  Done in ${Date.now() - hashStart}ms\n`);

  // ── FK-safe cleanup of existing seed users ──────────────────────
  // Must delete dependent rows before users, otherwise FK constraints
  // will reject the user.deleteMany. This mirrors cleanup-k6.ts order.

  const existing = await prisma.user.findMany({
    where: { email: { startsWith: EMAIL_PREFIX } },
    select: { id: true },
  });
  const seedUserIds = existing.map((u) => u.id);

  if (seedUserIds.length > 0) {
    console.log(`  Cleaning up ${seedUserIds.length} existing seed user(s)…`);

    const seedOrders = await prisma.order.findMany({
      where: { userId: { in: seedUserIds } },
      select: { id: true },
    });
    const seedOrderIds = seedOrders.map((o) => o.id);

    // FK-safe deletion order (same as cleanup-k6.ts)
    await prisma.idempotencyKey.deleteMany({ where: { userId: { in: seedUserIds } } });

    if (seedOrderIds.length > 0) {
      await prisma.payment.deleteMany({ where: { orderId: { in: seedOrderIds } } });
      await prisma.orderItem.deleteMany({ where: { orderId: { in: seedOrderIds } } });
      await prisma.refundRequest.deleteMany({
        where: { OR: [{ orderId: { in: seedOrderIds } }, { userId: { in: seedUserIds } }] },
      });
      await prisma.webhookEvent.deleteMany({
        where: { eventId: { startsWith: "evt_test_" } },
      });
      await prisma.$executeRawUnsafe(
        `DELETE FROM "Outbox" WHERE "aggregateId" IN (SELECT id FROM "Order" WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE '${EMAIL_PREFIX}%'))`,
      );
      await prisma.$executeRawUnsafe(
        `DELETE FROM "LedgerEntry" WHERE "orderId" IN (SELECT id FROM "Order" WHERE "userId" IN (SELECT id FROM "User" WHERE email LIKE '${EMAIL_PREFIX}%'))`,
      );
    }

    await prisma.order.deleteMany({ where: { userId: { in: seedUserIds } } });
    await prisma.cartItem.deleteMany({ where: { cart: { userId: { in: seedUserIds } } } });
    await prisma.cart.deleteMany({ where: { userId: { in: seedUserIds } } });
    await prisma.address.deleteMany({ where: { userId: { in: seedUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: seedUserIds } } });

    console.log(`  Done — clean slate ready.\n`);
  }

  // ── Bulk create in batches ───────────────────────────────────────
  const totalBatches = Math.ceil(COUNT / BATCH_SIZE);
  for (let batch = 0; batch < totalBatches; batch++) {
    const start = batch * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, COUNT);

    await prisma.user.createMany({
      data: Array.from({ length: end - start }, (_, i) => ({
        email: `${EMAIL_PREFIX}${start + i}@test.com`,
        passwordHash: hash,
        name: `K6 Seed ${start + i}`,
      })),
    });

    console.log(`  Created ${end}/${COUNT} users`);
  }

  console.log(`\nDone — ${COUNT} users ready for k6 load testing.`);
  console.log(`  Emails:  ${EMAIL_PREFIX}0@test.com … ${EMAIL_PREFIX}${COUNT - 1}@test.com`);
  console.log(`  Cleanup: npm run cleanup:k6`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
