import Link from "next/link";

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen flex-col">
            <header className="border-b border-slate-800 bg-slate-900 px-4 py-4">
                <Link href="/" className="text-2xl font-bold tracking-tight text-white">
                    Kart<span className="text-sky-400">It</span>
                </Link>
            </header>
            <main className="flex flex-1 items-center justify-center px-4 py-8">
                {children}
            </main>
        </div>
    );
}
