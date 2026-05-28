/**
 * Normalise an API error into a user-friendly string.
 * Handles `string`, the API's `{ code, message, details? }` shape, and
 * Zod-style `{ field: string[] | string }` detail objects.
 */
export function formatApiError(
    error: unknown,
    fallback = "Something went wrong",
): string {
    if (error == null) return fallback;
    if (typeof error === "string") return error || fallback;

    if (typeof error === "object" && error !== null) {
        const e = error as Record<string, unknown>;

        // Inline detail object (e.g. validation map { email: ["required"] })
        if (e.details && typeof e.details === "object") {
            const entries = Object.entries(e.details as Record<string, unknown>);
            if (entries.length > 0) {
                return entries
                    .map(([field, value]) => {
                        const messages = Array.isArray(value)
                            ? value.join(", ")
                            : typeof value === "string"
                              ? value
                              : JSON.stringify(value);
                        return `${field}: ${messages}`;
                    })
                    .join("; ");
            }
        }

        if (typeof e.message === "string" && e.message.length > 0) return e.message;
    }
    return fallback;
}
