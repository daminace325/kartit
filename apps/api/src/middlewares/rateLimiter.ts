import { Request, Response, NextFunction } from "express";
import { redis } from "../lib/redis";
import { logger } from "../lib/logger";

// ── Lua: atomic token-bucket check-and-consume ──────────────────
//
// Each bucket is a Redis hash: { tokens: number, last: timestamp-ms }.
// On every request we add elapsed * rate tokens (capped at capacity),
// then try to consume `cost` tokens. If insufficient, return the
// number of seconds until the next token arrives.
//
// Keys:      KEYS[1] — bucket key (e.g. "ratelimit:auth:127.0.0.1")
// Arguments: ARGV[1] — capacity (max tokens)
//            ARGV[2] — refill rate (tokens / second)
//            ARGV[3] — current timestamp in ms
//            ARGV[4] — cost (tokens to consume, default 1)
// Returns:   [allowed (0|1), remaining tokens (integer), retry-after (seconds)]
const TOKEN_BUCKET_SCRIPT = `
local bucket = redis.call('HMGET', KEYS[1], 'tokens', 'last')
local tokens = tonumber(bucket[1])
local last   = tonumber(bucket[2])
local now    = tonumber(ARGV[3])
local cap    = tonumber(ARGV[1])
local rate   = tonumber(ARGV[2])
local cost   = tonumber(ARGV[4])

-- First request for this bucket: start full
if tokens == nil then tokens = cap end
if last   == nil then last   = now end

-- Refill tokens based on elapsed wall-clock time
local elapsed = (now - last) / 1000.0
local refill  = elapsed * rate
if refill > 0 then
    tokens = math.min(cap, tokens + refill)
    last   = now
end

local allowed     = 0
local retry_after = 0

if tokens >= cost then
    tokens  = tokens - cost
    allowed = 1
else
    -- Seconds until the bucket accumulates enough tokens
    retry_after = math.ceil((cost - tokens) / rate)
end

-- Persist state, auto-expire when idle
redis.call('HMSET', KEYS[1], 'tokens', tokens, 'last', last)
local ttl = math.ceil(cap / rate) + 60
redis.call('EXPIRE', KEYS[1], ttl)

return {allowed, math.floor(tokens), retry_after}
`;

// ── Options ──────────────────────────────────────────────────────

export interface TokenBucketOptions {
    /** Redis key prefix (e.g. "ratelimit:auth") — scopes buckets. */
    prefix: string;
    /** Maximum tokens the bucket can hold (burst capacity). */
    capacity: number;
    /** Token refill rate in tokens per second. */
    rate: number;
    /** Tokens consumed per request (default 1). */
    cost?: number;
    /** Derive a rate-limit key from the request (default: req.ip). */
    keyGenerator?: (req: Request) => string;
    /** Skip the rate limit entirely for certain requests. */
    skip?: (req: Request) => boolean;
}

// ── Defaults ─────────────────────────────────────────────────────

const defaultKeyGenerator = (req: Request): string => req.ip ?? "unknown";

// ── Factory ──────────────────────────────────────────────────────

/**
 * Create Express middleware that enforces a Redis-backed token-bucket
 * rate limit. Fails **open** — if Redis is unreachable the request is
 * allowed through so the API remains available.
 */
export function createTokenBucketLimiter(opts: TokenBucketOptions) {
    const {
        prefix,
        capacity,
        rate,
        cost = 1,
        keyGenerator = defaultKeyGenerator,
        skip,
    } = opts;

    if (capacity <= 0) throw new Error(`[rate-limiter] capacity must be > 0 (got ${capacity})`);
    if (rate <= 0) throw new Error(`[rate-limiter] rate must be > 0 (got ${rate})`);

    return async (req: Request, res: Response, next: NextFunction) => {
        if (skip?.(req)) return next();

        const bucketKey = `${prefix}:${keyGenerator(req)}`;
        const now = Date.now();

        try {
            const result = (await redis.eval(
                TOKEN_BUCKET_SCRIPT,
                1,                // number of keys
                bucketKey,        // KEYS[1]
                capacity,         // ARGV[1]
                rate,             // ARGV[2]
                now,              // ARGV[3]
                cost,             // ARGV[4]
            )) as [number, number, number];

            const [allowed, remaining, retryAfter] = result;

            // IETF draft-7 rate-limit headers
            const resetEpoch =
                allowed && remaining > 0
                    ? Math.ceil(now / 1000) + Math.ceil(1 / rate)
                    : Math.ceil(now / 1000) + retryAfter;

            res.setHeader("RateLimit-Limit", String(capacity));
            res.setHeader("RateLimit-Remaining", String(remaining));
            res.setHeader("RateLimit-Reset", String(resetEpoch));

            if (allowed) {
                return next();
            }

            res.setHeader("Retry-After", String(retryAfter));
            res.status(429).json({
                code: "RATE_LIMITED",
                message: `Too many requests. Please retry after ${retryAfter} second${retryAfter === 1 ? "" : "s"}.`,
            });
        } catch (err) {
            // Fail open: a rate-limiter outage shouldn't bring down the API.
            logger.warn(
                `[rate-limiter] Redis unreachable for "${prefix}" — failing open: ${(err as Error).message}`,
            );
            return next();
        }
    };
}
