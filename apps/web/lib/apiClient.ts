/**
 * Unified API client for both server components and the browser.
 *
 * - **Server components** (RSC, route handlers, server actions): we hit the
 *   Express API directly and forward the auth cookie via the `Cookie`
 *   header (read from `next/headers cookies()`).
 * - **Browser**: we hit the same-origin `/api/*` path which is rewritten
 *   to the API in `next.config.ts`, so the httpOnly cookie set by the API
 *   is automatically attached.
 *
 * All errors land as a thrown `ApiClientError` with the API's
 * `{ code, message }` shape preserved when available.
 */

import type { ApiError } from "@repo/shared";

const SERVER_BASE =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
const COOKIE_NAME = process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME ?? "ecomm_auth";

export class ApiClientError extends Error {
    constructor(
        public status: number,
        public code: string,
        message: string,
        public details?: unknown,
    ) {
        super(message);
        this.name = "ApiClientError";
    }
}

export type FetchOptions = RequestInit & {
    /** Force "no-store" (default for mutations and authed reads). */
    cache?: RequestCache;
    /** Next.js revalidation tag/seconds (server only). */
    next?: { revalidate?: number; tags?: string[] };
};

const isServer = typeof window === "undefined";

async function buildHeaders(init: FetchOptions): Promise<Headers> {
    const headers = new Headers(init.headers ?? {});
    if (
        init.body != null &&
        !(init.body instanceof FormData) &&
        !headers.has("Content-Type")
    ) {
        headers.set("Content-Type", "application/json");
    }

    // CSRF protection: add header for state-changing requests.
    // GET/HEAD/OPTIONS are safe (no state change), others need the header.
    const method = (init.method ?? "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
        headers.set("X-Requested-With", "fetch");
    }

    if (isServer) {
        // Forward the auth cookie from the incoming request to the API.
        // Dynamic import so this file stays usable in client components.
        const { cookies } = await import("next/headers");
        const jar = await cookies();
        const token = jar.get(COOKIE_NAME)?.value;
        if (token) headers.set("Cookie", `${COOKIE_NAME}=${token}`);
    }
    return headers;
}

function buildUrl(path: string): string {
    if (!path.startsWith("/")) path = `/${path}`;
    return isServer ? `${SERVER_BASE}${path}` : `/api${path}`;
}

export async function apiFetch<T>(
    path: string,
    init: FetchOptions = {},
): Promise<T> {
    const url = buildUrl(path);
    const headers = await buildHeaders(init);

    const res = await fetch(url, {
        ...init,
        headers,
        credentials: isServer ? "omit" : "include",
        // Authed/dynamic data should not be cached unless caller opts in.
        cache: init.cache ?? (init.next ? undefined : "no-store"),
    });

    const text = await res.text();
    const parsed = text ? safeParse(text) : null;

    if (!res.ok) {
        const apiErr: ApiError | undefined =
            parsed && typeof parsed === "object" && "error" in parsed
                ? (parsed as { error: ApiError }).error
                : undefined;
        throw new ApiClientError(
            res.status,
            apiErr?.code ?? "REQUEST_FAILED",
            apiErr?.message ?? `Request failed (${res.status})`,
            apiErr?.details,
        );
    }

    return parsed as T;
}

function safeParse(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

// --- Convenience helpers -------------------------------------------------

export const api = {
    get: <T>(path: string, init?: FetchOptions) =>
        apiFetch<T>(path, { ...init, method: "GET" }),
    post: <T>(path: string, body?: unknown, init?: FetchOptions) =>
        apiFetch<T>(path, {
            ...init,
            method: "POST",
            body: body == null ? undefined : JSON.stringify(body),
        }),
    patch: <T>(path: string, body?: unknown, init?: FetchOptions) =>
        apiFetch<T>(path, {
            ...init,
            method: "PATCH",
            body: body == null ? undefined : JSON.stringify(body),
        }),
    put: <T>(path: string, body?: unknown, init?: FetchOptions) =>
        apiFetch<T>(path, {
            ...init,
            method: "PUT",
            body: body == null ? undefined : JSON.stringify(body),
        }),
    delete: <T>(path: string, init?: FetchOptions) =>
        apiFetch<T>(path, { ...init, method: "DELETE" }),
};
