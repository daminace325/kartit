import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { api } from "@/services/apiClient";
import { formatMoney, type ProductListResponse } from "@repo/shared";
import { productImageUrl } from "@/lib/image";
import DeleteButton from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
    const { items } = await api.get<ProductListResponse>("/products?limit=50");

    return (
        <div className="px-8 py-8">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-semibold text-white">Products</h1>
                    <p className="mt-1 text-sm text-slate-400">
                        {items.length} {items.length === 1 ? "product" : "products"}
                    </p>
                </div>
                <Link
                    href="/admin/products/new"
                    className="inline-flex items-center gap-2 rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400"
                >
                    <Plus className="h-4 w-4" />
                    New product
                </Link>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                {items.length === 0 ? (
                    <p className="p-8 text-center text-sm text-slate-400">
                        No products yet. Create your first one.
                    </p>
                ) : (
                    <table className="w-full">
                        <thead className="border-b border-slate-800 bg-slate-900/50 text-left text-xs uppercase tracking-wide text-slate-400">
                            <tr>
                                <th className="px-4 py-3 font-medium">Product</th>
                                <th className="px-4 py-3 font-medium">SKU</th>
                                <th className="px-4 py-3 font-medium">Slug</th>
                                <th className="px-4 py-3 font-medium">Price</th>
                                <th className="px-4 py-3 font-medium">Stock</th>
                                <th className="px-4 py-3 font-medium">Active</th>
                                <th className="px-4 py-3 text-right font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-sm">
                            {items.map((p) => {
                                const cover = productImageUrl(p.images[0], "thumb");
                                return (
                                    <tr key={p.id} className="hover:bg-slate-800/40">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-slate-800">
                                                    {cover ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={cover}
                                                            alt=""
                                                            className="h-full w-full object-cover"
                                                        />
                                                    ) : null}
                                                </div>
                                                <span className="font-medium text-white">
                                                    {p.name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-300">
                                            {p.sku}
                                        </td>
                                        <td className="px-4 py-3 text-slate-300">
                                            <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs">
                                                {p.slug}
                                            </code>
                                        </td>
                                        <td className="px-4 py-3 text-slate-300">
                                            {formatMoney(p.priceMinor, p.currency)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={
                                                    p.stock === 0
                                                        ? "rounded bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-300"
                                                        : p.stock < 5
                                                          ? "rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300"
                                                          : "rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300"
                                                }
                                            >
                                                {p.stock}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {p.isActive ? (
                                                <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
                                                    Yes
                                                </span>
                                            ) : (
                                                <span className="rounded bg-slate-700/30 px-2 py-0.5 text-xs font-medium text-slate-400">
                                                    No
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end gap-2">
                                                <Link
                                                    href={`/admin/products/${p.id}/edit`}
                                                    className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                    Edit
                                                </Link>
                                                <DeleteButton entityType="product" id={p.id} name={p.name} />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
