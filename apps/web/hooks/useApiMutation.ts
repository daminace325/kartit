"use client";

import { useState } from "react";
import { apiFetch, ApiClientError, type FetchOptions } from "@/lib/apiClient";
import { formatApiError } from "@/lib/formatApiError";

type Success<T> = { ok: true; data: T };
type Failure = { ok: false; error: string; status?: number };
type MutationResult<T = unknown> = Success<T> | Failure;

export function useApiMutation() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function clearError() {
        setError(null);
    }

    async function execute<T = unknown>(
        url: string,
        init: FetchOptions = {},
        fallbackError = "Something went wrong",
    ): Promise<MutationResult<T>> {
        setLoading(true);
        setError(null);
        try {
            const data = await apiFetch<T>(url, init);
            setLoading(false);
            return { ok: true, data };
        } catch (err) {
            const isApiErr = err instanceof ApiClientError;
            const msg = isApiErr
                ? formatApiError(
                      { message: err.message, details: err.details },
                      fallbackError,
                  )
                : "Network error. Please try again.";
            setError(msg);
            setLoading(false);
            return { ok: false, error: msg, status: isApiErr ? err.status : undefined };
        }
    }

    return { execute, loading, error, setError, clearError } as const;
}
