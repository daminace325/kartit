import { Queue } from "bullmq";
import { REDIS_URL } from "../lib/redis";

export const reconciliationQueue = new Queue("reconciliation", {
    connection: { url: REDIS_URL },
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 5000,
        },
        removeOnComplete: { age: 7 * 24 * 3600 },
        removeOnFail: { age: 30 * 24 * 3600 },
    },
});
