import Redis from "ioredis";
import { env } from "../config/env";
import { logger } from "./logger";

export const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
        if (times > 10) {
            logger.error("[redis] max retries reached, giving up");
            return null; // stop retrying
        }
        const delay = Math.min(times * 200, 2000);
        logger.warn(`[redis] connection attempt ${times}, retrying in ${delay}ms`);
        return delay;
    },
    lazyConnect: true, // don't crash on startup if Redis isn't available yet
});

redis.on("connect", () => {
    logger.info("[redis] connected");
});

redis.on("error", (err) => {
    logger.warn(`[redis] connection error: ${err.message}`);
});
