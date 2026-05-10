import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import CategoryForm from "../../CategoryForm";

export const dynamic = "force-dynamic";

type Category = { id: string; slug: string; name: string; parentId: string | null };

export default async function EditCategoryPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    let category: Category;
    try {
        ({ category } = await api.get<{ category: Category }>(
            `/categories/${encodeURIComponent(id)}`,
        ));
    } catch (err) {
        if (err instanceof ApiClientError && err.status === 404) notFound();
        throw err;
    }

    // Only top-level categories may be parents.
    const { categories: topLevel } = await api.get<{ categories: Category[] }>(
        "/categories?parentId=null",
    );

    return (
        <div className="px-8 py-8">
            <Link
                href="/admin/categories"
                className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to categories
            </Link>
            <h1 className="mb-6 text-3xl font-semibold text-white">Edit category</h1>
            <CategoryForm
                mode="edit"
                initial={category}
                parentOptions={topLevel.map((c) => ({ id: c.id, name: c.name }))}
            />
        </div>
    );
}
