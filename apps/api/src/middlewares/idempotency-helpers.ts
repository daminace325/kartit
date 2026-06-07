import { createHash } from "crypto";
import { IdempotencyStatus } from "@repo/db";

// ── Constants ────────────────────────────────────────────────

/** 24 h cache window per HANDOFF 1.1. */
export const TTL_SECONDS = 86_400;
export const TTL_MS = TTL_SECONDS * 1_000;
export const STALE_IN_PROGRESS_MS = 15 * 60 * 1_000;

// ── Domain types ─────────────────────────────────────────────

export type Claimed = { ok: true; requestHash: string };

export type Existing = {
	ok: false;
	requestHash: string;
	status: "COMPLETED" | "IN_PROGRESS";
	responseStatus: number;
	responseBody: unknown;
};

export type ClaimResult = Claimed | Existing;

// ── Hashing ─────────────────────────────────────────────────

/**
 * Deterministic JSON serialisation — keys are sorted so
 * `{a:1,b:2}` and `{b:2,a:1}` produce the same string.
 */
export function stableStringify(value: unknown): string {
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

/** SHA-256 of the (stably-serialised) request body. */
export function hashBody(body: unknown): string {
	const json = stableStringify(body ?? {});
	return createHash("sha256").update(json).digest("hex");
}

/**
 * Composite hash of (userId, key, bodyHash).
 * Same key + same body → replay.  Same key + different body → conflict.
 */
export function hashRequest(
	userId: string,
	key: string,
	body: unknown,
): string {
	const bodyHash = hashBody(body);
	return createHash("sha256")
		.update(`${userId}:${key}:${bodyHash}`)
		.digest("hex");
}

// ── Redis key helpers ───────────────────────────────────────

export function redisClaimKey(userId: string, key: string): string {
	return `idem:${userId}:${key}`;
}

export function redisResKey(userId: string, key: string): string {
	return `idem:${userId}:${key}:res`;
}

// ── Expiration / staleness checks ────────────────────────────

export function isExpired(
	row: { expiresAt: Date },
	now: Date,
): boolean {
	return row.expiresAt <= now;
}

export function isStaleInProgress(
	row: { status: IdempotencyStatus; createdAt: Date },
	now: Date,
): boolean {
	return (
		row.status === IdempotencyStatus.IN_PROGRESS &&
		now.getTime() - row.createdAt.getTime() > STALE_IN_PROGRESS_MS
	);
}
