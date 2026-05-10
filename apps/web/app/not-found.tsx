import Link from "next/link";

export default function NotFound() {
    return (
        <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-indigo-400">404</p>
            <h1 className="mt-3 text-3xl font-semibold">Page not found</h1>
            <p className="mt-3 text-sm text-slate-400">
                The page you’re looking for doesn’t exist or has been moved.
            </p>
            <Link
                href="/"
                className="mt-6 inline-flex items-center justify-center rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
            >
                Back to home
            </Link>
        </main>
    );
}
