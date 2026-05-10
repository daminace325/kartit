import Link from "next/link";
import { LayoutDashboard, Package, FolderTree, ShoppingBag, Home } from "lucide-react";
import SignOutButton from "@/components/SignOutButton";

type AdminSidebarProps = {
    user: { name: string | null; email: string };
};

const navItems = [
    { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/admin/products", icon: Package, label: "Products" },
    { href: "/admin/categories", icon: FolderTree, label: "Categories" },
    { href: "/admin/orders", icon: ShoppingBag, label: "Orders" },
];

export default function AdminSidebar({ user }: AdminSidebarProps) {
    return (
        <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 px-6 py-5">
                <Link href="/admin" className="text-xl font-bold tracking-tight">
                    Kart<span className="text-sky-400">It</span>
                    <span className="ml-2 rounded bg-sky-500/20 px-2 py-0.5 text-xs font-medium text-sky-300">
                        Admin
                    </span>
                </Link>
            </div>

            <nav className="flex-1 space-y-1 px-3 py-4">
                {navItems.map(({ href, icon: Icon, label }) => (
                    <Link
                        key={href}
                        href={href}
                        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                    >
                        <Icon className="h-5 w-5" />
                        {label}
                    </Link>
                ))}
            </nav>

            <div className="border-t border-slate-800 p-4">
                <div className="mb-3 px-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                        Signed in as
                    </p>
                    <p className="truncate text-sm font-medium text-white">
                        {user.name ?? user.email.split("@")[0]}
                    </p>
                    <p className="truncate text-xs text-slate-400">{user.email}</p>
                </div>
                <Link
                    href="/"
                    className="mb-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                    <Home className="h-4 w-4" />
                    Back to store
                </Link>
                <SignOutButton className="w-full rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700" />
            </div>
        </aside>
    );
}
