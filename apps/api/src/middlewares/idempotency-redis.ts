import { redis } from "../lib/redis";
import { logger } from "../lib/logger";
import {
	redisClaimKey,
	redisResKey,
	TTL_SECONDS,
	type ClaimResult,
} from "./idempotency-helpers";

// ── Redis claim / cache / release ───────────────────────────

/**
 * Try to claim the idempotency key in Redis.
 * SET NX is atomic — if another request already claimed the key we
 * get null back and fall through to the existing-key check.
 */
export async function tryRedisClaim(
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
			status: "IN_PROGRESS", // different hash → treat as conflict
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
	return {
		ok: false,
		requestHash,
		status: "IN_PROGRESS",
		responseStatus: 409,
		responseBody: null,
	};
}

/** Cache the response body in Redis so replays can skip the handler. */
export async function cacheRedisResponse(
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

/** Release a Redis claim (both claim + response keys). */
export async function releaseRedisClaim(
	userId: string,
	key: string,
): Promise<void> {
	const claimK = redisClaimKey(userId, key);
	const resK = redisResKey(userId, key);
	await redis.del(claimK, resK).catch((e: unknown) => {
		logger.warn("[idempotency] redis claim release failed", e);
	});
}

// ── Redis availability (circuit breaker) ─────────────────────

let redisAvailable = true;
const REDIS_CHECK_INTERVAL_MS = 30_000;
let lastRedisCheck = 0;

/**
 * Lightweight circuit breaker: if Redis was unreachable we skip it
 * for the next 30 s rather than paying the timeout on every request.
 */
export async function isRedisAvailable(): Promise<boolean> {
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
