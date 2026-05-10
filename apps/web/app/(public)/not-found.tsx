import Link from "next/link";

export default function PublicNotFound() {
    return (
        <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-indigo-400">404</p>
            <h1 className="mt-3 text-2xl font-semibold">We couldn’t find that page</h1>
            <p className="mt-3 text-sm text-slate-400">
                The product, category, or page you’re looking for is no longer available.
            </p>
            <div className="mt-6 flex gap-3">
                <Link
                    href="/"
                    className="inline-flex items-center justify-center rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
                >
                    Back to home
                </Link>
                <Link
                    href="/search"
                    className="inline-flex items-center justify-center rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500"
                >
                    Search products
                </Link>
            </div>
        </section>
    );
}
