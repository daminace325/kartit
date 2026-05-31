/**
 * Server-only auth helpers. Reads the API's httpOnly cookie via
 * `next/headers` and resolves to the current user (or null if signed out).
 */

import { cache } from "react";
import { redirect } from "next/navigation";
import { ApiClientError, apiFetch } from "@/services/apiClient";
import type { UserRole } from "@repo/shared";

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_RULES_TEXT = `At least ${PASSWORD_MIN_LENGTH} characters.`;

type SessionUser = {
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

/**
 * Returns the current signed-in user or redirects to sign-in. Pass the page
 * path as `returnTo` so the sign-in page redirects back after login.
 */
export async function authRequired(returnTo: string): Promise<SessionUser> {
    const user = await getCurrentUser();
    if (!user) redirect(`/signin?next=${encodeURIComponent(returnTo)}`);
    return user;
}
