import { prisma } from "@repo/db";

export const healthService = {
    async check() {
        await prisma.$queryRaw`SELECT 1`;
        return { status: "ok", db: "up" as const };
    },
};
