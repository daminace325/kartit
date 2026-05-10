import Link from "next/link";

export default function AdminNotFound() {
    return (
        <section className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-indigo-400">404</p>
            <h1 className="mt-3 text-2xl font-semibold">Resource not found</h1>
            <p className="mt-3 text-sm text-slate-400">
                The admin resource you’re looking for doesn’t exist or has been removed.
            </p>
            <Link
                href="/admin"
                className="mt-6 inline-flex items-center justify-center rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
            >
                Back to admin
            </Link>
        </section>
    );
}
