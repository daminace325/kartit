import { createHash } from "crypto";
import type { RequestHandler } from "express";
import { IdempotencyStatus, Prisma, prisma } from "@repo/db";
import { redis } from "../lib/redis";
import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";

// 24h cache window per HANDOFF 1.1.
const TTL_SECONDS = 86400;
const TTL_MS = TTL_SECONDS * 1000;
const STALE_IN_PROGRESS_MS = 15 * 60 * 1000;

type Claimed = { ok: true; requestHash: string };
type Existing = {
    ok: false;
    requestHash: string;
    status: "COMPLETED" | "IN_PROGRESS";
    responseStatus: number;
    responseBody: unknown;
};
type ClaimResult = Claimed | Existing;

// Produce a stable hash of the request body so the same key + same body
// replays, while same key + different body is rejected as a conflict.
function hashBody(body: unknown): string {
    const json = stableStringify(body ?? {});
    return createHash("sha256").update(json).digest("hex");
}

function hashRequest(userId: string, key: string, body: unknown): string {
    const bodyHash = hashBody(body);
    return createHash("sha256")
        .update(`${userId}:${key}:${bodyHash}`)
        .digest("hex");
}

function stableStringify(value: unknown): string {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) {
        return "[" + value.map(stableStringify).join(",") + "]";
    }
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return (
        "{" +
        keys
            .map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k]))
            .join(",") +
        "}"
    );
}

// ── Redis key helpers ────────────────────────────────────────

function redisClaimKey(userId: string, key: string) {
    return `idem:${userId}:${key}`;
}
function redisResKey(userId: string, key: string) {
    return `idem:${userId}:${key}:res`;
}

/**
 * Try to claim the idempotency key in Redis.
 * SET NX is atomic — if another request already claimed the key we
 * get null back and fall through to the existing-key check.
 */
async function tryRedisClaim(
    userId: string,
    key: string,
    requestHash: string,
): Promise<ClaimResult> {
    const claimK = redisClaimKey(userId, key);
    const resK = redisResKey(userId, key);

    const claimed = await redis.set(claimK, requestHash, "EX", TTL_SECONDS, "NX");
    if (claimed === "OK") {
        return { ok: true, requestHash };
    }

    // Key already exists — check for conflict or replay.
    const existingHash = await redis.get(claimK);
    if (!existingHash) {
        // Key expired between SET NX and GET — retry claim.
        return tryRedisClaim(userId, key, requestHash);
    }

    if (existingHash !== requestHash) {
        return {
            ok: false,
            requestHash: existingHash,
            status: "IN_PROGRESS", // with different hash → treat as conflict
            responseStatus: 409,
            responseBody: null,
        };
    }

    // Same hash — check if the response has been cached.
    const cached = await redis.get(resK);
    if (cached) {
        const sep = cached.indexOf(":");
        const responseStatus = Number(cached.slice(0, sep));
        const responseBody = JSON.parse(cached.slice(sep + 1));
        return {
            ok: false,
            requestHash,
            status: "COMPLETED",
            responseStatus,
            responseBody,
        };
    }

    // Same hash, no cached response → still IN_PROGRESS.
    return { ok: false, requestHash, status: "IN_PROGRESS", responseStatus: 409, responseBody: null };
}

async function cacheRedisResponse(
    userId: string,
    key: string,
    status: number,
    body: unknown,
): Promise<void> {
    const resK = redisResKey(userId, key);
    const value = `${status}:${JSON.stringify(body)}`;
    await redis.set(resK, value, "EX", TTL_SECONDS).catch((e: unknown) => {
        logger.warn("[idempotency] redis response cache failed", e);
    });
}

async function releaseRedisClaim(userId: string, key: string): Promise<void> {
    const claimK = redisClaimKey(userId, key);
    const resK = redisResKey(userId, key);
    await redis.del(claimK, resK).catch((e: unknown) => {
        logger.warn("[idempotency] redis claim release failed", e);
    });
}

// ── Postgres fallback helpers ────────────────────────────────

function isExpired(row: { expiresAt: Date }, now: Date): boolean {
    return row.expiresAt <= now;
}

function isStaleInProgress(
    row: { status: IdempotencyStatus; createdAt: Date },
    now: Date,
): boolean {
    return (
        row.status === IdempotencyStatus.IN_PROGRESS &&
        now.getTime() - row.createdAt.getTime() > STALE_IN_PROGRESS_MS
    );
}

async function removeRecoverableClaim(
    row: { id: string; status: IdempotencyStatus; createdAt: Date; expiresAt: Date },
    now: Date,
): Promise<boolean> {
    if (!isExpired(row, now) && !isStaleInProgress(row, now)) return false;

    await prisma.idempotencyKey
        .delete({ where: { id: row.id } })
        .catch(() => {
            /* lost a race with another request/cleanup; retry below */
        });
    return true;
}

function cleanupRecoverableClaims(now: Date): void {
    void prisma.idempotencyKey
        .deleteMany({
            where: {
                OR: [
                    { expiresAt: { lte: now } },
                    {
                        status: IdempotencyStatus.IN_PROGRESS,
                        createdAt: {
                            lt: new Date(now.getTime() - STALE_IN_PROGRESS_MS),
                        },
                    },
                ],
            },
        })
        .catch((e: unknown) => {
            logger.error("idempotency cleanup failed", e);
        });
}

// ── Postgres fallback path (original logic from P1.1) ─────────

async function postgresPath(
    userId: string,
    key: string,
    requestHash: string,
    expiresAt: Date,
    now: Date,
): Promise<Existing | null> {
    cleanupRecoverableClaims(now);

    try {
        await prisma.idempotencyKey.create({
            data: {
                userId,
                key,
                requestHash,
                status: IdempotencyStatus.IN_PROGRESS,
                expiresAt,
            },
        });
        return null; // claimed successfully (caller handles)
    } catch (err) {
        if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2002"
        ) {
            const existing = await prisma.idempotencyKey.findUnique({
                where: { userId_key: { userId, key } },
            });

            if (existing && (await removeRecoverableClaim(existing, now))) {
                return postgresPath(userId, key, requestHash, expiresAt, now);
            }

            if (!existing) {
                return postgresPath(userId, key, requestHash, expiresAt, now);
            }

            if (existing.requestHash !== requestHash) {
                return {
                    ok: false,
                    requestHash: existing.requestHash,
                    status: "IN_PROGRESS",
                    responseStatus: 409,
                    responseBody: null,
                };
            }

            if (existing.status === IdempotencyStatus.IN_PROGRESS) {
                return {
                    ok: false,
                    requestHash,
                    status: "IN_PROGRESS",
                    responseStatus: 409,
                    responseBody: null,
                };
            }

            // COMPLETED → replay.
            return {
                ok: false,
                requestHash,
                status: "COMPLETED",
                responseStatus: existing.responseStatus ?? 200,
                responseBody: existing.responseBody ?? {},
            };
        }
        throw err;
    }
}

/**
 * Fire-and-forget: ensure a Postgres row exists for this key (durable fallback).
 * Called after a successful Redis claim so the hot path is fast; Postgres
 * write happens asynchronously.
 */
function ensurePostgresRow(
    userId: string,
    key: string,
    requestHash: string,
    expiresAt: Date,
): void {
    void prisma.idempotencyKey
        .create({
            data: {
                userId,
                key,
                requestHash,
                status: IdempotencyStatus.IN_PROGRESS,
                expiresAt,
            },
        })
        .catch((e: unknown) => {
            // P2002 = row already exists (another request or previous attempt) — fine.
            if (
                !(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
            ) {
                logger.warn("[idempotency] postgres row creation failed", e);
            }
        });
}

function updatePostgresCompleted(
    userId: string,
    key: string,
    status: number,
    body: unknown,
): void {
    void prisma.idempotencyKey
        .updateMany({
            where: {
                userId,
                key,
                status: IdempotencyStatus.IN_PROGRESS,
            },
            data: {
                status: IdempotencyStatus.COMPLETED,
                responseStatus: status,
                responseBody: body as Prisma.InputJsonValue,
            },
        })
        .catch((e: unknown) => {
            logger.warn("[idempotency] postgres completion update failed", e);
        });
}

function deletePostgresClaim(userId: string, key: string): void {
    void prisma.idempotencyKey
        .delete({ where: { userId_key: { userId, key } } })
        .catch((e: unknown) => {
            logger.warn("[idempotency] postgres claim release failed", e);
        });
}

// ── Redis availability check ─────────────────────────────────

let redisAvailable = true;
const REDIS_CHECK_INTERVAL_MS = 30_000;
let lastRedisCheck = 0;

async function isRedisAvailable(): Promise<boolean> {
    const now = Date.now();
    if (now - lastRedisCheck < REDIS_CHECK_INTERVAL_MS) return redisAvailable;

    try {
        await redis.ping();
        redisAvailable = true;
    } catch {
        redisAvailable = false;
    }
    lastRedisCheck = now;
    return redisAvailable;
}

// ── Middleware ────────────────────────────────────────────────

/**
 * Idempotency-Key middleware (P1.1 + P2.2 Redis hot path).
 *
 * - Header is optional. Without it, requests pass through unchanged.
 * - With it, we scope the key to the authenticated user, bind it to a hash
 *   of (userId, key, sha256(requestBody)), and cache the eventual 2xx
 *   response for 24h.
 * - P2.2: Redis hot path via SET NX for atomic claim. Postgres serves as
 *   durable fallback when Redis is unavailable.
 * - Same key + same body -> replay cached response.
 * - Same key + different body -> 409 IDEMPOTENCY_CONFLICT.
 * - Same key still in flight -> 409 IDEMPOTENCY_IN_PROGRESS.
 * - Stale IN_PROGRESS rows are removed so a crashed process cannot block
 *   checkout forever.
 * - Non-2xx responses are NOT cached so the client can safely retry.
 *
 * Must run AFTER requireAuth and AFTER express.json().
 */
export const idempotency: RequestHandler = async (req, res, next) => {
    const rawKey = req.header("Idempotency-Key");
    if (!rawKey) return next();

    const key = rawKey.trim();
    if (!key) return next();
    if (key.length > 255) {
        return next(
            AppError.badRequest(
                "VALIDATION_FAILED",
                "Idempotency-Key must be <=255 characters",
            ),
        );
    }

    const user = req.user;
    if (!user) return next(AppError.unauthorized());

    const userId = user.id;
    const requestHash = hashRequest(userId, key, req.body);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TTL_MS);

    // ── Try Redis hot path ──────────────────────────────
    if (await isRedisAvailable()) {
        const result = await tryRedisClaim(userId, key, requestHash);

        if (result.ok) {
            // Successfully claimed in Redis.
            // Fire-and-forget Postgres row for durability.
            ensurePostgresRow(userId, key, requestHash, expiresAt);

            // Hook res.json to cache the response.
            const originalJson = res.json.bind(res);
            let captured = false;

            res.json = ((body: unknown) => {
                if (captured) return originalJson(body);
                captured = true;

                const status = res.statusCode || 200;
                if (status >= 200 && status < 300) {
                    // Cache in Redis (fast), then update Postgres (durable).
                    cacheRedisResponse(userId, key, status, body);
                    updatePostgresCompleted(userId, key, status, body);
                    return originalJson(body);
                }

                // Non-2xx → release claims so client can retry.
                releaseRedisClaim(userId, key);
                deletePostgresClaim(userId, key);
                return originalJson(body);
            }) as typeof res.json;

            // Release claim if response ends without res.json being called.
            res.on("close", () => {
                if (captured) return;
                releaseRedisClaim(userId, key);
                deletePostgresClaim(userId, key);
            });

            return next();
        }

        // Key already exists — handle conflict/replay.
        if (result.requestHash !== requestHash) {
            return next(
                new AppError(
                    409,
                    "IDEMPOTENCY_CONFLICT",
                    "Idempotency-Key was reused with a different request body",
                ),
            );
        }

        if (result.status === "IN_PROGRESS") {
            return next(
                new AppError(
                    409,
                    "IDEMPOTENCY_IN_PROGRESS",
                    "A request with this Idempotency-Key is still being processed",
                ),
            );
        }

        // COMPLETED → replay cached response from Redis.
        res.setHeader("Idempotency-Replayed", "true");
        res.status(result.responseStatus).json(result.responseBody);
        return;
    }

    // ── Postgres fallback path ──────────────────────────
    const pgResult = await postgresPath(userId, key, requestHash, expiresAt, now);

    if (pgResult) {
        // Key already existed — conflict or replay.
        if (pgResult.requestHash !== requestHash) {
            return next(
                new AppError(
                    409,
                    "IDEMPOTENCY_CONFLICT",
                    "Idempotency-Key was reused with a different request body",
                ),
            );
        }

        if (pgResult.status === "IN_PROGRESS") {
            return next(
                new AppError(
                    409,
                    "IDEMPOTENCY_IN_PROGRESS",
                    "A request with this Idempotency-Key is still being processed",
                ),
            );
        }

        res.setHeader("Idempotency-Replayed", "true");
        res.status(pgResult.responseStatus).json(pgResult.responseBody);
        return;
    }

    // Successfully claimed in Postgres — hook res.json.
    const originalJson = res.json.bind(res);
    let pgCaptured = false;

    res.json = ((body: unknown) => {
        if (pgCaptured) return originalJson(body);
        pgCaptured = true;

        const status = res.statusCode || 200;
        if (status >= 200 && status < 300) {
            void prisma.idempotencyKey
                .updateMany({
                    where: {
                        userId,
                        key,
                        status: IdempotencyStatus.IN_PROGRESS,
                    },
                    data: {
                        status: IdempotencyStatus.COMPLETED,
                        responseStatus: status,
                        responseBody: body as Prisma.InputJsonValue,
                    },
                })
                .then(() => {
                    originalJson(body);
                })
                .catch((e: unknown) => {
                    logger.error("idempotency cache update failed", e);
                    if (!res.headersSent) {
                        res.status(500).json({
                            error: {
                                code: "INTERNAL",
                                message: "Internal server error",
                            },
                        });
                    }
                });
            return res;
        }

        // Non-2xx → drop the claim so the client can safely retry.
        void prisma.idempotencyKey
            .delete({ where: { userId_key: { userId, key } } })
            .catch((e: unknown) => {
                logger.error("idempotency claim release failed", e);
            });

        return originalJson(body);
    }) as typeof res.json;

    res.on("close", () => {
        if (pgCaptured) return;
        prisma.idempotencyKey
            .delete({ where: { userId_key: { userId, key } } })
            .catch(() => {
                /* best-effort */
            });
    });

    next();
};
