import type { Response } from "express";

/**
 * Monkey-patch `res.json` to intercept the **first** JSON response.
 *
 * ─ Behaviour ─
 * - **2xx:** fires `onSuccess(status, body)` fire-and-forget, then sends
 *   the response **immediately** via the original `res.json`.  The durable
 *   store update runs asynchronously — a cache-write hiccup never blocks
 *   or replaces a successful HTTP response.
 * - **non-2xx:** fires `onNon2xx()` fire-and-forget (typically releases
 *   the claim so the client can safely retry), then sends the response
 *   immediately.
 * - **No `res.json` called at all** (e.g. `res.send`, redirect, or
 *    client disconnect): the `"close"` listener fires `onNon2xx()` to
 *    clean up the claim.
 *
 * This function is shared by the Redis hot-path and the Postgres
 * fallback so the interception logic lives in exactly one place.
 */
export function hookResJson(
	res: Response,
	onSuccess: (status: number, body: unknown) => void,
	onNon2xx: () => void,
): void {
	const originalJson = res.json.bind(res);
	let captured = false;

	res.json = ((body: unknown) => {
		if (captured) return originalJson(body);
		captured = true;

		const status = res.statusCode || 200;
		if (status >= 200 && status < 300) {
			// Fire-and-forget the durable store update THEN send the response
			// immediately.  The client never waits for Redis / Postgres.
			void onSuccess(status, body);
			return originalJson(body);
		}

		// Non-2xx → release claims so the client can safely retry.
		void onNon2xx();
		return originalJson(body);
	}) as typeof res.json;

	// Release claim if response ends without res.json being called.
	res.on("close", () => {
		if (captured) return;
		onNon2xx();
	});
}
