/**
 * Wrapper around fetch that automatically adds CSRF header for
 * state-changing requests (POST, PUT, PATCH, DELETE).
 * Use this instead of raw fetch() for requests to the API.
 */
export async function csrfFetch(
    input: RequestInfo | URL,
    init: RequestInit = {},
): Promise<Response> {
    const method = (init.method ?? "GET").toUpperCase();
    const isMutating = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";

    const headers = new Headers(init.headers);
    if (isMutating) {
        headers.set("X-Requested-With", "fetch");
    }

    return fetch(input, {
        ...init,
        headers,
        credentials: "include",
    });
}