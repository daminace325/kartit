"use client";

import { useEffect } from "react";

export default function PublicError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-8 text-center">
            <h2 className="text-xl font-semibold text-red-100">
                Couldn&apos;t load this page
            </h2>
            <p className="mt-2 text-sm text-red-200/80">
                {error?.message ?? "Something went wrong."}
            </p>
            {error?.digest && (
                <p className="mt-1 text-xs text-red-200/60">Error ID: {error.digest}</p>
            )}
            <button
                type="button"
                onClick={reset}
                className="mt-6 inline-flex items-center justify-center rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-400"
            >
                Try again
            </button>
        </div>
    );
}
