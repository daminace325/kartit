/**
 * Server-only auth helpers. Reads the API's httpOnly cookie via
 * `next/headers` and resolves to the current user (or null if signed out).
 */

import { cache } from "react";
import { ApiClientError, apiFetch } from "./api";
import type { UserRole } from "@repo/shared";

export type SessionUser = {
    id: string;
    email: string;
    name: string | null;
    role: UserRole;
};

/**
 * Returns the current signed-in user or `null`. Cached per-request so multiple
 * server components in the same render don't re-fetch.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
    try {
        const { user } = await apiFetch<{ user: SessionUser }>("/auth/me");
        return user;
    } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) return null;
        throw err;
    }
});
