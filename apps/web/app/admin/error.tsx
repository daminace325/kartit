"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AdminError({
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
        <div className="px-8 py-10">
            <div className="mx-auto max-w-xl rounded-md border border-red-500/40 bg-red-500/10 p-6 text-center">
                <h2 className="text-lg font-semibold text-red-100">Admin error</h2>
                <p className="mt-2 text-sm text-red-200/80">
                    {error?.message ?? "Something went wrong."}
                </p>
                {error?.digest && (
                    <p className="mt-1 text-xs text-red-200/60">
                        Error ID: {error.digest}
                    </p>
                )}
                <div className="mt-5 flex justify-center gap-3">
                    <button
                        type="button"
                        onClick={reset}
                        className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-400"
                    >
                        Try again
                    </button>
                    <Link
                        href="/admin"
                        className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500"
                    >
                        Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
