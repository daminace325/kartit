// Redis-backed TTL cache. P2 swaps the in-process Map for Redis;
// the interface (get/set/del) stays the same but is now async.
// Falls back gracefully when Redis is unavailable (cache miss / no-op).

import { redis } from "./redis";
import { logger } from "./logger";
import type { CategoryDTO } from "@repo/shared";

class TtlCache<T> {
    private prefix: string;

    constructor(prefix: string) {
        this.prefix = prefix;
    }

    async get(key: string): Promise<T | undefined> {
        try {
            const raw = await redis.get(`${this.prefix}:${key}`);
            if (!raw) return undefined;
            return JSON.parse(raw) as T;
        } catch (err) {
            logger.warn(`[cache] get failed for ${this.prefix}:${key}: ${err instanceof Error ? err.message : err}`);
            return undefined;
        }
    }

    async set(key: string, value: T, ttlMs: number): Promise<void> {
        try {
            await redis.set(`${this.prefix}:${key}`, JSON.stringify(value), "PX", ttlMs);
        } catch (err) {
            logger.warn(`[cache] set failed for ${this.prefix}:${key}: ${err instanceof Error ? err.message : err}`);
        }
    }

    async del(key: string): Promise<void> {
        try {
            await redis.del(`${this.prefix}:${key}`);
        } catch (err) {
            logger.warn(`[cache] del failed for ${this.prefix}:${key}: ${err instanceof Error ? err.message : err}`);
        }
    }
}

interface CachedUser {
    id: string;
    role: string;
    tokenVersion: number;
}

export const userCache = new TtlCache<CachedUser>("cache:user");

// Phase 1: Category caches
export const categoryCache = new TtlCache<CategoryDTO>("cache:category");
export const categoryListCache = new TtlCache<CategoryDTO[]>("cache:category:list");
