"use client";

import { useState } from "react";
import { csrfFetch } from "@/lib/csrf";
import { formatApiError } from "@/lib/formatApiError";

type Success<T> = { ok: true; data: T; response: Response };
type Failure = { ok: false; error: string; response: Response };
type MutationResult<T = unknown> = Success<T> | Failure;

export function useApiMutation() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function clearError() {
        setError(null);
    }

    async function execute<T = unknown>(
        url: string,
        init: RequestInit = {},
        fallbackError = "Something went wrong",
    ): Promise<MutationResult<T>> {
        setLoading(true);
        setError(null);
        try {
            const res = await csrfFetch(url, init);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const msg = formatApiError(data?.error, fallbackError);
                setError(msg);
                setLoading(false);
                return { ok: false, error: msg, response: res };
            }
            setLoading(false);
            return { ok: true, data: data as T, response: res };
        } catch {
            const msg = "Network error. Please try again.";
            setError(msg);
            setLoading(false);
            return { ok: false, error: msg, response: new Response() };
        }
    }

    return { execute, loading, error, setError, clearError } as const;
}
