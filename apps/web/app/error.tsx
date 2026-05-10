"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function RootError({
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
        <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-rose-400">
                Error
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white">
                Something went wrong
            </h1>
            <p className="mt-3 text-sm text-slate-400">
                An unexpected error occurred while loading this page.
            </p>
            {error?.digest && (
                <p className="mt-2 text-xs text-slate-500">Error ID: {error.digest}</p>
            )}
            <div className="mt-6 flex gap-3">
                <button
                    type="button"
                    onClick={reset}
                    className="inline-flex items-center justify-center rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400"
                >
                    Try again
                </button>
                <Link
                    href="/"
                    className="inline-flex items-center justify-center rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500"
                >
                    Go home
                </Link>
            </div>
        </main>
    );
}
