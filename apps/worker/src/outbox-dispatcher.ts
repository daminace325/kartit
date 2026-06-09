import { prisma } from "@repo/db";
import type { Queue } from "bullmq";
import { getQueueForEvent } from "./queues/index";

const MAX_ATTEMPTS = 5;

export interface DispatcherOptions {
    /** Polling interval in ms (default: 5_000). */
    pollIntervalMs?: number;
    /** Number of PENDING rows to fetch per poll cycle (default: 50). */
    batchSize?: number;
}

/**
 * Starts the outbox dispatcher loop.
 *
 * Polls the Outbox table for rows with status=PENDING, enqueues each row
 * to its target BullMQ queue, then marks it SENT. If enqueuing fails,
 * increments the attempts counter; after MAX_ATTEMPTS the row is marked
 * FAILED so ops can investigate.
 *
 * Guarantees **at-least-once** delivery: if the process dies between the
 * BullMQ `add` and the Prisma `update` that sets SENT, the row will be
 * picked up again on the next poll. Workers must be idempotent.
 */
export function startOutboxDispatcher(
    queueMap: Record<string, Queue>,
    options: DispatcherOptions = {},
): void {
    const { pollIntervalMs = 5_000, batchSize = 50 } = options;

    let running = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll(): Promise<void> {
        if (!running) return;

        try {
            const rows = await prisma.outbox.findMany({
                where: { status: "PENDING" },
                orderBy: { createdAt: "asc" },
                take: batchSize,
            });

            if (rows.length > 0) {
                console.log(`[outbox-dispatcher] processing ${rows.length} PENDING rows`);
            }

            for (const row of rows) {
                const queueName = getQueueForEvent(row.eventType);
                const queue = queueMap[queueName];

                if (!queue) {
                    await prisma.outbox.update({
                        where: { id: row.id },
                        data: {
                            attempts: row.attempts + 1,
                            lastError: `No queue mapped for eventType: ${row.eventType}`,
                            status: "FAILED",
                        },
                    });
                    console.warn(
                        `[outbox-dispatcher] unknown queue for eventType=${row.eventType} — marked FAILED`,
                    );
                    continue;
                }

                try {
                    await queue.add(row.eventType, {
                        outboxId: row.id,
                        aggregateType: row.aggregateType,
                        aggregateId: row.aggregateId,
                        eventType: row.eventType,
                        payload: row.payload,
                    });

                    await prisma.outbox.update({
                        where: { id: row.id },
                        data: { status: "SENT", sentAt: new Date() },
                    });
                } catch (err) {
                    const errorMessage =
                        err instanceof Error ? err.message : String(err);
                    const newAttempts = row.attempts + 1;

                    console.error(
                        `[outbox-dispatcher] enqueue failed outboxId=${row.id} eventType=${row.eventType} attempt=${newAttempts} err=${errorMessage}`,
                    );

                    await prisma.outbox.update({
                        where: { id: row.id },
                        data: {
                            attempts: newAttempts,
                            lastError: errorMessage,
                            status:
                                newAttempts >= MAX_ATTEMPTS
                                    ? "FAILED"
                                    : "PENDING",
                        },
                    });
                }
            }

            // Log DLQ depth when FAILED rows exist (alerting — P2.10 will wire to pino).
            if (rows.length > 0) {
                const failedCount = await prisma.outbox.count({
                    where: { status: "FAILED" },
                });
                if (failedCount > 0) {
                    console.warn(
                        `[outbox-dispatcher] DLQ depth: ${failedCount} FAILED outbox rows`,
                    );
                }
            }
        } catch (err) {
            const message =
                err instanceof Error ? err.message : String(err);
            console.error(
                `[outbox-dispatcher] poll error: ${message}`,
            );
        }

        timer = setTimeout(poll, pollIntervalMs);
    }

    function stop(): void {
        running = false;
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    }

    // Start the loop.
    poll();

    // Graceful shutdown hook — the entry point attaches additional handlers.
    process.on("SIGTERM", stop);
    process.on("SIGINT", stop);

    console.log(
        `[outbox-dispatcher] started (pollInterval=${pollIntervalMs}ms batchSize=${batchSize})`,
    );
}
