import { IdempotencyStatus, prisma } from "@repo/db";
import { redis } from "../lib/redis";
import { logger } from "../lib/logger";

/**
 * Promotes idempotency keys that have a cached response in Redis but
 * are still IN_PROGRESS in Postgres (e.g. fire-and-forget writes that
 * failed during the hot path). Run periodically as a safety net.
 *
 * Usage: npm run job:promote-idempotency
 */
async function promoteIdempotencyKeys(): Promise<number> {
    // Find all IN_PROGRESS keys that haven't expired yet.
    const inProgress = await prisma.idempotencyKey.findMany({
        where: {
            status: IdempotencyStatus.IN_PROGRESS,
            expiresAt: { gt: new Date() },
        },
        select: { userId: true, key: true },
        take: 500, // batch size
    });

    if (inProgress.length === 0) return 0;

    let promotedCount = 0;

    for (const row of inProgress) {
        try {
            const resKey = `idem:${row.userId}:${row.key}:res`;
            const cached = await redis.get(resKey);
            if (!cached) continue; // genuinely still in progress or expired in Redis

            // Parse the cached response.
            const sep = cached.indexOf(":");
            if (sep === -1) continue;
            const responseStatus = Number(cached.slice(0, sep));
            const responseBody = JSON.parse(cached.slice(sep + 1));

            await prisma.idempotencyKey.updateMany({
                where: {
                    userId: row.userId,
                    key: row.key,
                    status: IdempotencyStatus.IN_PROGRESS,
                },
                data: {
                    status: IdempotencyStatus.COMPLETED,
                    responseStatus,
                    responseBody,
                },
            });

            promotedCount++;
        } catch (err) {
            logger.warn(
                `[promote-idempotency] failed for ${row.userId}:${row.key}`,
                err,
            );
        }
    }

    return promotedCount;
}

// Run directly when invoked via ts-node/script runner.
if (require.main === module) {
    promoteIdempotencyKeys()
        .then((count) => {
            logger.info(`Promoted ${count} idempotency keys from Redis to Postgres`);
            process.exit(0);
        })
        .catch((err) => {
            logger.error("Idempotency promotion failed:", err);
            process.exit(1);
        });
}
