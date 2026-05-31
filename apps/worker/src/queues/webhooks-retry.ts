import { Queue } from "bullmq";
import { REDIS_URL } from "../lib/redis";

export const webhooksRetryQueue = new Queue("webhooks-retry", {
    connection: { url: REDIS_URL },
    defaultJobOptions: {
        attempts: 8,
        backoff: {
            type: "exponential",
            delay: 10000,
        },
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: { age: 30 * 24 * 3600 },
    },
});
