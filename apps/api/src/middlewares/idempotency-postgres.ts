import { IdempotencyStatus, Prisma, prisma } from "@repo/db";
import { logger } from "../lib/logger";
import {
	STALE_IN_PROGRESS_MS,
	isExpired,
	isStaleInProgress,
	type Existing,
} from "./idempotency-helpers";

// ── Recovery ────────────────────────────────────────────────

/**
 * Remove a single claim if it is expired or has been IN_PROGRESS too long.
 * Returns `true` when the row was (likely) deleted — caller should retry.
 */
export async function removeRecoverableClaim(
	row: {
		id: string;
		status: IdempotencyStatus;
		createdAt: Date;
		expiresAt: Date;
	},
	now: Date,
): Promise<boolean> {
	if (!isExpired(row, now) && !isStaleInProgress(row, now)) return false;

	await prisma.idempotencyKey
		.delete({ where: { id: row.id } })
		.catch(() => {
			/* lost a race with another request / cleanup; retry below */
		});
	return true;
}

/** Bulk cleanup of expired or stale IN_PROGRESS rows (best-effort). */
export function cleanupRecoverableClaims(now: Date): void {
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

// ── Postgres fallback claim path ─────────────────────────────

/**
 * Try to claim the idempotency key via a Postgres unique constraint.
 *
 * Returns `null` when the claim succeeded (the caller should proceed with
 * the handler).  Returns an `Existing` record when the key was already
 * claimed by another request (conflict, in-progress, or completed).
 */
export async function postgresPath(
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

// ── Fire-and-forget Postgres helpers ─────────────────────────

/**
 * Fire-and-forget: ensure a Postgres row exists for this key (durable
 * fallback).  Called after a successful Redis claim so the hot path is
 * fast; the Postgres write happens asynchronously.
 */
export function ensurePostgresRow(
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
				!(
					e instanceof Prisma.PrismaClientKnownRequestError &&
					e.code === "P2002"
				)
			) {
				logger.warn("[idempotency] postgres row creation failed", e);
			}
		});
}

/**
 * Mark a key as COMPLETED in Postgres (fire-and-forget).
 * The response has already been sent to the client — failures here are
 * logged but never surfaced to the caller.
 */
export function updatePostgresCompleted(
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

/** Delete the Postgres claim row (fire-and-forget). */
export function deletePostgresClaim(userId: string, key: string): void {
	void prisma.idempotencyKey
		.delete({ where: { userId_key: { userId, key } } })
		.catch((e: unknown) => {
			logger.warn("[idempotency] postgres claim release failed", e);
		});
}
