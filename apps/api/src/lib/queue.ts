import { Queue } from "bullmq";
import { env } from "../config/env";

/**
 * BullMQ queue for webhook retries. The API enqueues retry jobs here when
 * webhook processing fails; the worker process picks them up and re-attempts.
 */
export const webhooksRetryQueue = new Queue("webhooks-retry", {
    connection: { url: env.REDIS_URL },
    defaultJobOptions: {
        attempts: 8,
        backoff: {
            type: "exponential",
            delay: 10_000, // start at 10s, double each retry
        },
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: { age: 30 * 24 * 3600 },
    },
});
