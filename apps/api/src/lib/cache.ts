// Redis-backed TTL cache. P2 swaps the in-process Map for Redis;
// the interface (get/set/del) stays the same but is now async.
// Falls back gracefully when Redis is unavailable (cache miss / no-op).

import { redis } from "./redis";
import { logger } from "./logger";
import { env } from "../config/env";
import type { CategoryDTO, ProductDTO, ProductListResponse, PromotionType } from "@repo/shared";

// ── Cache instrumentation (test/benchmark only) ──────────────────
// Per-prefix hit/miss counters power the cache benchmark's hit-ratio
// reporting. Counting is a couple of integer increments — negligible.
interface PrefixStat {
    hits: number;
    misses: number;
}
const cacheStats = new Map<string, PrefixStat>();

function record(prefix: string, kind: "hit" | "miss"): void {
    let s = cacheStats.get(prefix);
    if (!s) {
        s = { hits: 0, misses: 0 };
        cacheStats.set(prefix, s);
    }
    if (kind === "hit") s.hits++;
    else s.misses++;
}

export interface CacheStats {
    byPrefix: Record<string, { hits: number; misses: number; hitRate: number }>;
    totalHits: number;
    totalMisses: number;
    overallHitRate: number;
}

export function getCacheStats(): CacheStats {
    const byPrefix: CacheStats["byPrefix"] = {};
    let totalHits = 0;
    let totalMisses = 0;
    for (const [prefix, s] of cacheStats) {
        const total = s.hits + s.misses;
        byPrefix[prefix] = {
            hits: s.hits,
            misses: s.misses,
            hitRate: total ? s.hits / total : 0,
        };
        totalHits += s.hits;
        totalMisses += s.misses;
    }
    const total = totalHits + totalMisses;
    return {
        byPrefix,
        totalHits,
        totalMisses,
        overallHitRate: total ? totalHits / total : 0,
    };
}

export function resetCacheStats(): void {
    cacheStats.clear();
}

// ── Runtime cache on/off switch ──────────────────────────────────
// Initialised from DISABLE_CACHE but flippable at runtime via the
// /internal/cache endpoint so the benchmark can A/B the same API
// process without a restart.
let cacheDisabled = env.DISABLE_CACHE;

export function setCacheDisabled(disabled: boolean): void {
    cacheDisabled = disabled;
}

export function isCacheDisabled(): boolean {
    return cacheDisabled;
}

/** Delete every `cache:*` key so a benchmark phase starts cold. */
export async function flushAllCaches(): Promise<number> {
    const keys = await redis.keys("cache:*");
    if (keys.length === 0) return 0;
    await redis.del(...keys);
    return keys.length;
}

class TtlCache<T> {
    private prefix: string;

    constructor(prefix: string) {
        this.prefix = prefix;
    }

    async get(key: string): Promise<T | undefined> {
        if (cacheDisabled) {
            record(this.prefix, "miss");
            return undefined;
        }
        try {
            const raw = await redis.get(`${this.prefix}:${key}`);
            if (!raw) {
                record(this.prefix, "miss");
                return undefined;
            }
            record(this.prefix, "hit");
            return JSON.parse(raw) as T;
        } catch (err) {
            record(this.prefix, "miss");
            logger.warn(`[cache] get failed for ${this.prefix}:${key}: ${err instanceof Error ? err.message : err}`);
            return undefined;
        }
    }

    async set(key: string, value: T, ttlMs: number): Promise<void> {
        if (cacheDisabled) return;
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

// Phase 2: Product caches
export const productCache = new TtlCache<ProductDTO>("cache:product");

// Phase 3: Promotion caches
interface CachedPromotion {
    id: string;
    code: string;
    type: PromotionType;
    value: string; // bigint serialised
    minSubtotalMinor: string | null;
    maxUses: number | null;
    maxUsesPerUser: number | null;
    startsAt: string | null; // ISO
    endsAt: string | null;
    isActive: boolean;
}
export const promotionCache = new TtlCache<CachedPromotion>("cache:promotion");

// Phase 4: Product list cache (homepage)
export const productListCache = new TtlCache<ProductListResponse>("cache:product:list");
