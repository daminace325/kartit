import { Worker } from "bullmq";
import { REDIS_URL } from "../lib/redis";

/**
 * Processes inventory-sweep jobs from the "inventory-sweep" queue.
 *
 * P2.7 will implement repeatable sweep jobs so the cron-based sweep
 * (apps/api/src/jobs/sweepAbandonedOrders.ts) can be retired. For now
 * we log so the pipeline is wired.
 */
const worker = new Worker(
    "inventory-sweep",
    async (job) => {
        const { eventType } = job.data;

        console.log(
            `[inventory-sweep] eventType=${eventType}`,
        );

        switch (eventType) {
            case "inventory.sweep-abandoned":
                console.log(
                    `[inventory-sweep] → sweep abandoned PENDING orders older than 30 min`,
                );
                // P2.7: move sweep logic here from apps/api/src/jobs/
                break;

            default:
                console.log(
                    `[inventory-sweep] unhandled eventType=${eventType}`,
                );
        }
    },
    {
        connection: { url: REDIS_URL },
        concurrency: 1,
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: { age: 7 * 24 * 3600 },
    },
);

worker.on("failed", (job, err) => {
    console.error(
        `[inventory-sweep] job failed id=${job?.id} eventType=${job?.data?.eventType} err=${err.message}`,
    );
});

worker.on("error", (err) => {
    console.error(`[inventory-sweep] worker error: ${err.message}`);
});

export { worker as inventorySweepWorker };
