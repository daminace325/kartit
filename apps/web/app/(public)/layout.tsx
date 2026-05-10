import Navbar from "@/components/Navbar";

export default function PublicLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <Navbar />
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
                {children}
            </main>
            <footer className="border-t border-slate-800 bg-slate-900 px-4 py-6 text-center text-sm text-slate-400">
                © {new Date().getFullYear()} KartIt
            </footer>
        </>
    );
}
