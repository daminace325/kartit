"use client";

import ErrorPage from "@/components/ErrorPage";

export default function RootError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-rose-400">
                Error
            </p>
            <ErrorPage
                error={error}
                reset={reset}
                title="Something went wrong"
                message="An unexpected error occurred while loading this page."
                showDigest
                homeHref="/"
                homeLabel="Go home"
                buttonColor="bg-sky-500 hover:bg-sky-400"
                titleClassName="mt-3 text-3xl font-semibold text-white"
                messageClassName="mt-3 text-sm text-slate-400"
            />
        </main>
    );
}
