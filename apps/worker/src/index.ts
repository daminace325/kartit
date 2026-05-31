/**
 * ecomm Worker — BullMQ-based background job processor.
 *
 * Responsibilities:
 *   1. Start all BullMQ workers (order-events, emails, reconciliation,
 *      webhooks-retry, inventory-sweep).
 *   2. Start the outbox dispatcher — polls the Outbox table for PENDING
 *      rows and enqueues them into BullMQ.
 *   3. Graceful shutdown on SIGTERM / SIGINT.
 *
 * Usage:
 *   npm run dev -w apps/worker     # development (auto-restart via tsx watch)
 *   npm run build -w apps/worker && npm run start -w apps/worker  # production
 */

import { queues } from "./queues/index";
import { startOutboxDispatcher } from "./outbox-dispatcher";
import {
    orderEventsWorker,
    emailsWorker,
    reconciliationWorker,
    webhooksRetryWorker,
    inventorySweepWorker,
} from "./workers/index";

const workers = [
    orderEventsWorker,
    emailsWorker,
    reconciliationWorker,
    webhooksRetryWorker,
    inventorySweepWorker,
];

// ── Shutdown ──────────────────────────────────────────────────────────────

let shuttingDown = false;

async function shutdown(): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log("[worker] shutting down...");

    // Close all BullMQ workers first (stop accepting new jobs, wait for
    // in-flight jobs to finish).
    await Promise.allSettled(workers.map((w) => w.close()));

    // Close all queue connections.
    for (const [name, queue] of Object.entries(queues)) {
        await queue.close().catch((err) => {
            console.warn(`[worker] error closing queue ${name}: ${err.message}`);
        });
    }

    console.log("[worker] shutdown complete");
    process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ── Startup ───────────────────────────────────────────────────────────────

console.log("[worker] starting ecomm worker service...");

// Start the outbox dispatcher (polls Outbox table → enqueues to BullMQ).
startOutboxDispatcher(queues);

console.log("[worker] workers running");
console.log(
    `[worker] queues: ${Object.keys(queues).join(", ")}`,
);

// Keep the process alive. BullMQ workers run on the event loop.
