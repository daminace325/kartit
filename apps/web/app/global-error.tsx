"use client";

import { useEffect } from "react";

export default function GlobalError({
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
        <html lang="en">
            <body className="min-h-screen bg-slate-950 text-slate-100">
                <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
                    <p className="text-sm font-medium uppercase tracking-widest text-rose-400">
                        Critical error
                    </p>
                    <h1 className="mt-3 text-3xl font-semibold text-white">
                        The application crashed
                    </h1>
                    <p className="mt-3 text-sm text-slate-400">
                        Please try reloading. If the problem persists, contact support.
                    </p>
                    {error?.digest && (
                        <p className="mt-2 text-xs text-slate-500">
                            Error ID: {error.digest}
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={reset}
                        className="mt-6 inline-flex items-center justify-center rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400"
                    >
                        Reload
                    </button>
                </main>
            </body>
        </html>
    );
}
