import { Queue } from "bullmq";
import { REDIS_URL } from "../lib/redis";

export const emailsQueue = new Queue("emails", {
    connection: { url: REDIS_URL },
    defaultJobOptions: {
        attempts: 5,
        backoff: {
            type: "exponential",
            delay: 2000,
        },
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: { age: 7 * 24 * 3600 },
    },
});
