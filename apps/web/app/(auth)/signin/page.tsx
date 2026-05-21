"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ErrorBanner } from "@/components/ErrorBanner";

export default function SigninPage() {
    return (
        <Suspense fallback={null}>
            <SigninForm />
        </Suspense>
    );
}

function SigninForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const next = searchParams.get("next") ?? "/";

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const { execute, loading, error, clearError } = useApiMutation();

    async function handleSubmit(e: React.SyntheticEvent) {
        e.preventDefault();
        const result = await execute(
            "/auth/signin",
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            },
            "Sign in failed",
        );
        if (!result.ok) return;

        router.push(next);
        router.refresh();
    }

    return (
        <div className="w-full max-w-md rounded-md border border-slate-700 bg-slate-800 p-8 shadow-lg">
            <h1 className="mb-6 text-center text-2xl font-semibold text-white">
                Sign in to KartIt
            </h1>

            <ErrorBanner message={error} className="mb-4" />

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-200">
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white placeholder-slate-400 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    />
                </div>

                <div>
                    <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-200">
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-white placeholder-slate-400 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded bg-sky-500 px-4 py-2 font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {loading ? "Signing in..." : "Sign in"}
                </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-400">
                New to KartIt?{" "}
                <Link
                    href={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
                    className="font-medium text-sky-400 hover:underline"
                >
                    Create an account
                </Link>
            </p>
        </div>
    );
}
