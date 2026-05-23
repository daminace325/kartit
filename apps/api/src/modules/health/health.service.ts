import { prisma } from "@repo/db";

export const healthService = {
    async check() {
        try {
            await prisma.$queryRaw`SELECT 1`;
            return { status: "ok" as const, db: "up" as const };
        } catch (err) {
            return {
                status: "error" as const,
                db: "down" as const,
                message: err instanceof Error ? err.message : "unknown",
            };
        }
    },
};
