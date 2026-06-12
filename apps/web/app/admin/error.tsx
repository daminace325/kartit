"use client";

import ErrorPage from "@/components/ErrorPage";

export default function AdminError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="px-8 py-10">
            <div className="mx-auto max-w-xl rounded-md border border-red-500/40 bg-red-500/10 p-6 text-center">
                <ErrorPage
                    error={error}
                    reset={reset}
                    title="Admin error"
                    showDigest
                    homeHref="/admin"
                    homeLabel="Dashboard"
                />
            </div>
        </div>
    );
}
