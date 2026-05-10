import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import CategoryForm from "../CategoryForm";

export const dynamic = "force-dynamic";

type Category = { id: string; slug: string; name: string; parentId: string | null };

export default async function NewCategoryPage() {
    // Only top-level categories may be parents (2-level limit).
    const { categories } = await api.get<{ categories: Category[] }>(
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
            <h1 className="mb-6 text-3xl font-semibold text-white">New category</h1>
            <CategoryForm
                mode="create"
                parentOptions={categories.map((c) => ({ id: c.id, name: c.name }))}
            />
        </div>
    );
}
