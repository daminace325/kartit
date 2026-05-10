import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
    // eslint-disable-next-line no-var
    var __prisma: PrismaClient | undefined;
}

function makeClient() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL is not set");
    }
    const adapter = new PrismaPg({ connectionString });
    return new PrismaClient({
        adapter,
        log: ["warn", "error"],
    });
}

export const prisma = global.__prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") {
    global.__prisma = prisma;
}

export * from "@prisma/client";
