import { Worker } from "bullmq";
import { REDIS_URL } from "../lib/redis";

/**
 * Processes webhook-retry jobs from the "webhooks-retry" queue.
 *
 * P2.9 will implement: reprocess Stripe webhooks that failed on first
 * delivery, with capped attempts and exponential backoff. For now we log
 * so the pipeline is wired.
 */
const worker = new Worker(
    "webhooks-retry",
    async (job) => {
        const { eventType, aggregateId, payload } = job.data;

        console.log(
            `[webhooks-retry] eventType=${eventType} aggregateId=${aggregateId}`,
        );

        // P2.9: retry delivery to external webhook endpoints
        console.log(
            `[webhooks-retry] → retry webhook id=${aggregateId} type=${payload?.type}`,
        );
    },
    {
        connection: { url: REDIS_URL },
        concurrency: 5,
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: { age: 30 * 24 * 3600 },
    },
);

worker.on("failed", (job, err) => {
    console.error(
        `[webhooks-retry] job failed id=${job?.id} eventType=${job?.data?.eventType} err=${err.message}`,
    );
});

worker.on("error", (err) => {
    console.error(`[webhooks-retry] worker error: ${err.message}`);
});

export { worker as webhooksRetryWorker };
