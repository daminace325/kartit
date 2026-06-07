import type { RequestHandler } from "express";
import { AppError } from "../lib/errors";
import { hashRequest, TTL_MS } from "./idempotency-helpers";
import {
	tryRedisClaim,
	cacheRedisResponse,
	releaseRedisClaim,
	isRedisAvailable,
} from "./idempotency-redis";
import {
	postgresPath,
	ensurePostgresRow,
	updatePostgresCompleted,
	deletePostgresClaim,
} from "./idempotency-postgres";
import { hookResJson } from "./idempotency-response-hook";

/**
 * Idempotency-Key middleware (P1.1 + P2.2 Redis hot path).
 *
 * - Header is optional. Without it, requests pass through unchanged.
 * - With it, we scope the key to the authenticated user, bind it to a hash
 *   of (userId, key, sha256(requestBody)), and cache the eventual 2xx
 *   response for 24 h.
 * - P2.2: Redis hot path via SET NX for atomic claim. Postgres serves as
 *   durable fallback when Redis is unavailable.
 * - Same key + same body → replay cached response.
 * - Same key + different body → 409 IDEMPOTENCY_CONFLICT.
 * - Same key still in flight → 409 IDEMPOTENCY_IN_PROGRESS.
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

	// ── Redis hot path ──────────────────────────────────────────
	if (await isRedisAvailable()) {
		const result = await tryRedisClaim(userId, key, requestHash);

		if (result.ok) {
			// Successfully claimed in Redis.
			// Fire-and-forget Postgres row for durability.
			ensurePostgresRow(userId, key, requestHash, expiresAt);

			// Hook res.json to cache the response.
			hookResJson(
				res,
				(status, body) => {
					cacheRedisResponse(userId, key, status, body);
					updatePostgresCompleted(userId, key, status, body);
				},
				() => {
					releaseRedisClaim(userId, key);
					deletePostgresClaim(userId, key);
				},
			);

			return next();
		}

		// Key already exists — handle conflict / replay.
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

	// ── Postgres fallback path ──────────────────────────────────
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
	// The Postgres completion write is fire-and-forget: the HTTP response
	// is sent immediately via originalJson.  A PG hiccup after a successful
	// handler run no longer turns a 2xx into a 500.
	hookResJson(
		res,
		(status, body) => {
			updatePostgresCompleted(userId, key, status, body);
		},
		() => {
			deletePostgresClaim(userId, key);
		},
	);

	next();
};

// Re-export types for convenience.
export type { Claimed, Existing, ClaimResult } from "./idempotency-helpers";
