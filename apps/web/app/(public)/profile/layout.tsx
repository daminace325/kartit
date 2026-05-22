import Link from "next/link";
import { UserPen, MapPin, KeyRound, ArrowLeft } from "lucide-react";
import { authRequired } from "@/lib/auth";

const items = [
    { href: "/profile", icon: UserPen, label: "Edit Profile" },
    { href: "/profile/addresses", icon: MapPin, label: "Addresses" },
    { href: "/profile/security", icon: KeyRound, label: "Login & Security" },
];

export const dynamic = "force-dynamic";

export default async function ProfileLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    await authRequired("/profile");

    return (
        <main className="mx-auto max-w-6xl px-4 py-8">
            <Link
                href="/account"
                className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to account
            </Link>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
                <aside className="h-fit rounded-md border border-slate-700 bg-slate-800 p-2">
                    <nav className="space-y-1">
                        {items.map(({ href, icon: Icon, label }) => (
                            <Link
                                key={href}
                                href={href}
                                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                            >
                                <Icon className="h-4 w-4" />
                                {label}
                            </Link>
                        ))}
                    </nav>
                </aside>
                <section>{children}</section>
            </div>
        </main>
    );
}
