/**
 * Redis connection URL for BullMQ.
 *
 * We pass the URL directly to BullMQ rather than an ioredis instance to avoid
 * type conflicts with BullMQ's bundled ioredis version. BullMQ creates its own
 * ioredis connection internally from the URL.
 */
export const REDIS_URL =
    process.env.REDIS_URL ?? "redis://localhost:6379";
