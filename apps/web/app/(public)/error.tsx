"use client";

import ErrorPage from "@/components/ErrorPage";

export default function PublicError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-8 text-center">
            <ErrorPage
                error={error}
                reset={reset}
                title="Couldn't load this page"
            />
        </div>
    );
}
