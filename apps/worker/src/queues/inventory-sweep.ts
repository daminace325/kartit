import { Queue } from "bullmq";
import { REDIS_URL } from "../lib/redis";

export const inventorySweepQueue = new Queue("inventory-sweep", {
    connection: { url: REDIS_URL },
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 5000,
        },
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: { age: 7 * 24 * 3600 },
    },
});
