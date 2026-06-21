import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
    // eslint-disable-next-line no-var
    var __prisma: PrismaClient | undefined;
}

// ── DB read-query counter (test/benchmark only) ──────────────────
// Enabled only when EXPOSE_TEST_METRICS=true so the cache benchmark can
// measure how many read queries actually reach Postgres. Production never
// applies the extension, so there is zero overhead.
let dbReadCount = 0;
const READ_OPERATIONS = new Set([
    "findUnique",
    "findUniqueOrThrow",
    "findFirst",
    "findFirstOrThrow",
    "findMany",
    "count",
    "aggregate",
    "groupBy",
]);

export function getDbReadCount(): number {
    return dbReadCount;
}

export function resetDbReadCount(): void {
    dbReadCount = 0;
}

function makeClient() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL is not set");
    }
    const adapter = new PrismaPg({ connectionString });
    const base = new PrismaClient({
        adapter,
        log: ["warn", "error"],
    });

    if (process.env.EXPOSE_TEST_METRICS !== "true") {
        return base;
    }

    // Count read operations across all models. Raw queries ($queryRaw,
    // advisory locks) are intentionally excluded — the cached read paths
    // all use model operations (findMany / findUnique / count).
    return base.$extends({
        query: {
            $allModels: {
                async $allOperations({ operation, args, query }) {
                    if (READ_OPERATIONS.has(operation)) dbReadCount++;
                    return query(args);
                },
            },
        },
    }) as unknown as PrismaClient;
}

export const prisma = global.__prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") {
    global.__prisma = prisma;
}

export * from "@prisma/client";
export * from "./inventory";
