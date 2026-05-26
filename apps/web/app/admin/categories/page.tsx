import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { api } from "@/services/apiClient";
import DeleteButton from "@/components/DeleteButton";

export const dynamic = "force-dynamic";

type Category = { id: string; slug: string; name: string; parentId: string | null; isActive: boolean };

export default async function AdminCategoriesPage() {
    const { categories } = await api.get<{ categories: Category[] }>("/categories?includeInactive=true");
    const nameById = new Map(categories.map((c) => [c.id, c.name]));

    return (
        <div className="px-8 py-8">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-semibold text-white">Categories</h1>
                    <p className="mt-1 text-sm text-slate-400">
                        {categories.length}{" "}
                        {categories.length === 1 ? "category" : "categories"}
                    </p>
                </div>
                <Link
                    href="/admin/categories/new"
                    className="inline-flex items-center gap-2 rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400"
                >
                    <Plus className="h-4 w-4" />
                    New category
                </Link>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                {categories.length === 0 ? (
                    <p className="p-8 text-center text-sm text-slate-400">
                        No categories yet. Create your first one.
                    </p>
                ) : (
                    <table className="w-full">
                        <thead className="border-b border-slate-800 bg-slate-900/50 text-left text-xs uppercase tracking-wide text-slate-400">
                            <tr>
                                <th className="px-4 py-3 font-medium">Name</th>
                                <th className="px-4 py-3 font-medium">Slug</th>
                                <th className="px-4 py-3 font-medium">Parent</th>
                                <th className="px-4 py-3 font-medium">Active</th>
                                <th className="px-4 py-3 text-right font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-sm">
                            {categories.map((c) => (
                                <tr key={c.id} className="hover:bg-slate-800/40">
                                    <td className="px-4 py-3 font-medium text-white">{c.name}</td>
                                    <td className="px-4 py-3 text-slate-300">
                                        <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs">
                                            {c.slug}
                                        </code>
                                    </td>
                                    <td className="px-4 py-3 text-slate-300">
                                        {c.parentId ? (nameById.get(c.parentId) ?? "—") : "—"}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={c.isActive ? "text-emerald-400" : "text-red-400"}>
                                            {c.isActive ? "Yes" : "No"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-2">
                                            <Link
                                                href={`/admin/categories/${c.id}/edit`}
                                                className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
                                            >
                                                <Pencil className="h-4 w-4" />
                                                Edit
                                            </Link>
                                            <DeleteButton entityType="category" id={c.id} name={c.name} />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
