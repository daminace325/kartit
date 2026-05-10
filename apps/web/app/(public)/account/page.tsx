import Link from "next/link";
import { redirect } from "next/navigation";
import { ShoppingBag, UserPen, MapPin, KeyRound, LogOut, LayoutDashboard } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import SignOutButton from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
    const user = await getCurrentUser();
    if (!user) redirect("/signin?next=/account");

    const tiles = [
        {
            href: "/orders",
            icon: ShoppingBag,
            title: "Your Orders",
            desc: "Track, return, or buy things again",
        },
        {
            href: "/profile",
            icon: UserPen,
            title: "Edit Profile",
            desc: "Update your name and account details",
        },
        {
            href: "/profile/addresses",
            icon: MapPin,
            title: "Your Addresses",
            desc: "Add or remove delivery addresses",
        },
        {
            href: "/profile/security",
            icon: KeyRound,
            title: "Login & Security",
            desc: "Change your password",
        },
    ];

    if (user.role === "ADMIN") {
        tiles.push({
            href: "/admin",
            icon: LayoutDashboard,
            title: "Admin Dashboard",
            desc: "Manage products, categories, and orders",
        });
    }

    return (
        <main className="mx-auto max-w-5xl px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-semibold text-white">Your Account</h1>
                <p className="mt-1 text-sm text-slate-400">
                    Hello,{" "}
                    <span className="font-medium text-slate-200">
                        {user.name ?? user.email}
                    </span>
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {tiles.map(({ href, icon: Icon, title, desc }) => (
                    <Link
                        key={href}
                        href={href}
                        className="group flex items-start gap-4 rounded-lg border border-slate-700 bg-slate-800 p-5 shadow-sm transition hover:border-sky-400 hover:shadow"
                    >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-300 group-hover:bg-sky-500/20">
                            <Icon className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-white">{title}</h2>
                            <p className="mt-1 text-sm text-slate-300">{desc}</p>
                        </div>
                    </Link>
                ))}

                <div className="flex items-start gap-4 rounded-lg border border-slate-700 bg-slate-800 p-5 shadow-sm">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-red-500/10 text-red-300">
                        <LogOut className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                        <h2 className="font-semibold text-white">Sign Out</h2>
                        <p className="mt-1 text-sm text-slate-300">End your current session</p>
                        <SignOutButton className="mt-3 inline-flex rounded bg-sky-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-400" />
                    </div>
                </div>
            </div>
        </main>
    );
}
