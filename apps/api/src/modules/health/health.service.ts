import { prisma } from "@repo/db";
import { redis } from "../../lib/redis";

export const healthService = {
    async check() {
        const result: {
            status: "ok" | "error";
            db: "up" | "down";
            redis: "up" | "down";
            message?: string;
        } = { status: "ok", db: "up", redis: "up" };

        try {
            await prisma.$queryRaw`SELECT 1`;
        } catch (err) {
            result.status = "error";
            result.db = "down";
            result.message = err instanceof Error ? err.message : "unknown";
        }

        try {
            await redis.ping();
        } catch (err) {
            result.status = "error";
            result.redis = "down";
            if (!result.message) {
                result.message = err instanceof Error ? err.message : "unknown";
            }
        }

        return result;
    },
};
