import Link from "next/link";
import { Package, FolderTree, ShoppingBag } from "lucide-react";
import { api } from "@/services/apiClient";
import type { OrderListResponse, ProductDTO } from "@repo/shared";

export const dynamic = "force-dynamic";

type Category = { id: string; slug: string; name: string };
type ProductList = { items: ProductDTO[]; nextCursor: string | null };

export default async function AdminDashboardPage() {
    // The Express API doesn't expose count endpoints in P1 — we fetch a page
    // of each resource and use the length as a "≥ N" indicator.
    const [{ categories }, { items: products }, { items: orders }] =
        await Promise.all([
            api.get<{ categories: Category[] }>("/categories").catch(() => ({
                categories: [] as Category[],
            })),
            api.get<ProductList>("/products?limit=50").catch(() => ({
                items: [] as ProductDTO[],
                nextCursor: null,
            })),
            api.get<OrderListResponse>("/orders?limit=50").catch(() => ({
                items: [],
                nextCursor: null,
            })),
        ]);

    const pendingOrders = orders.filter((o) => o.status === "PENDING").length;

    const stats = [
        {
            href: "/admin/products",
            icon: Package,
            label: "Products",
            value: products.length,
            accent: "text-sky-400",
            bg: "bg-sky-500/10",
        },
        {
            href: "/admin/categories",
            icon: FolderTree,
            label: "Categories",
            value: categories.length,
            accent: "text-emerald-400",
            bg: "bg-emerald-500/10",
        },
        {
            href: "/admin/orders",
            icon: ShoppingBag,
            label: "Orders",
            value: orders.length,
            accent: "text-amber-400",
            bg: "bg-amber-500/10",
        },
    ];

    return (
        <div className="px-8 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-semibold text-white">Dashboard</h1>
                <p className="mt-1 text-sm text-slate-400">
                    Overview of your store at a glance
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {stats.map(({ href, icon: Icon, label, value, accent, bg }) => (
                    <Link
                        key={label}
                        href={href}
                        className="group rounded-lg border border-slate-800 bg-slate-900 p-5 transition hover:border-slate-700 hover:bg-slate-800/60"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-400">{label}</span>
                            <div
                                className={`flex h-10 w-10 items-center justify-center rounded-md ${bg} ${accent}`}
                            >
                                <Icon className="h-5 w-5" />
                            </div>
                        </div>
                        <p className="mt-4 text-3xl font-semibold text-white">{value}</p>
                    </Link>
                ))}
            </div>

            {pendingOrders > 0 && (
                <div className="mt-8 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-amber-200">
                                {pendingOrders} pending order{pendingOrders === 1 ? "" : "s"}
                            </p>
                            <p className="mt-1 text-sm text-amber-200/70">
                                Review awaiting-payment orders.
                            </p>
                        </div>
                        <Link
                            href="/admin/orders"
                            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400"
                        >
                            Review
                        </Link>
                    </div>
                </div>
            )}

            <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Link
                    href="/admin/products/new"
                    className="rounded-lg border border-slate-800 bg-slate-900 p-5 transition hover:border-sky-500/50 hover:bg-slate-800/60"
                >
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-sky-500/10 text-sky-400">
                            <Package className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">Add a product</h3>
                            <p className="text-sm text-slate-400">
                                Create a new product listing
                            </p>
                        </div>
                    </div>
                </Link>
                <Link
                    href="/admin/categories/new"
                    className="rounded-lg border border-slate-800 bg-slate-900 p-5 transition hover:border-emerald-500/50 hover:bg-slate-800/60"
                >
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
                            <FolderTree className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">Add a category</h3>
                            <p className="text-sm text-slate-400">
                                Organize products into a new category
                            </p>
                        </div>
                    </div>
                </Link>
            </div>
        </div>
    );
}
