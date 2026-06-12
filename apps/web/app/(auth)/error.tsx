"use client";

import ErrorPage from "@/components/ErrorPage";

export default function AuthError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="w-full max-w-md rounded-md border border-red-500/40 bg-red-500/10 p-6 text-center">
            <ErrorPage
                error={error}
                reset={reset}
                title="Authentication error"
                homeHref="/"
                homeLabel="Go home"
            />
        </div>
    );
}
