import { createHash } from "crypto";
import type { RequestHandler } from "express";
import { IdempotencyStatus, Prisma, prisma } from "@repo/db";
import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";

// 24h cache window per HANDOFF 1.1.
const TTL_MS = 24 * 60 * 60 * 1000;
const STALE_IN_PROGRESS_MS = 15 * 60 * 1000;

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

/**
 * Idempotency-Key middleware (P1.1).
 *
 * - Header is optional. Without it, requests pass through unchanged.
 * - With it, we scope the key to the authenticated user, bind it to a hash
 *   of (userId, key, sha256(requestBody)), and cache the eventual 2xx
 *   response for 24h.
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

    cleanupRecoverableClaims(now);

    // Try to claim the key. If another request already claimed it we'll
    // fall through to the lookup branch via P2002.
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
    } catch (err) {
        if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2002"
        ) {
            const existing = await prisma.idempotencyKey.findUnique({
                where: { userId_key: { userId, key } },
            });

            if (existing && (await removeRecoverableClaim(existing, now))) {
                return idempotency(req, res, next);
            }

            if (!existing) {
                // Row vanished between create-conflict and lookup. Retry once.
                return idempotency(req, res, next);
            }

            if (existing.requestHash !== requestHash) {
                return next(
                    new AppError(
                        409,
                        "IDEMPOTENCY_CONFLICT",
                        "Idempotency-Key was reused with a different request body",
                    ),
                );
            }

            if (existing.status === IdempotencyStatus.IN_PROGRESS) {
                return next(
                    new AppError(
                        409,
                        "IDEMPOTENCY_IN_PROGRESS",
                        "A request with this Idempotency-Key is still being processed",
                    ),
                );
            }

            // COMPLETED -> replay cached response.
            res.setHeader("Idempotency-Replayed", "true");
            res.status(existing.responseStatus ?? 200).json(
                existing.responseBody ?? {},
            );
            return;
        }
        return next(err);
    }

    // Patch res.json to persist a successful response before it is sent.
    // This avoids a window where an order could commit while the key remains
    // IN_PROGRESS because the process exited before a fire-and-forget update.
    const originalJson = res.json.bind(res);
    let captured = false;

    res.json = ((body: unknown) => {
        if (captured) return originalJson(body);
        captured = true;

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

        // Non-2xx -> drop the claim so the client can safely retry.
        void prisma.idempotencyKey
            .delete({ where: { userId_key: { userId, key } } })
            .catch((e: unknown) => {
                logger.error("idempotency claim release failed", e);
            });

        return originalJson(body);
    }) as typeof res.json;

    // Also release the claim if the response ends without res.json being
    // called (e.g. errorHandler wrote a body via send, or a raw send).
    res.on("close", () => {
        if (captured) return;
        prisma.idempotencyKey
            .delete({ where: { userId_key: { userId, key } } })
            .catch(() => {
                /* best-effort */
            });
    });

    next();
};
