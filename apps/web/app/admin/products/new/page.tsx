import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api } from "@/services/apiClient";
import ProductForm from "../ProductForm";

export const dynamic = "force-dynamic";

type Category = { id: string; slug: string; name: string };

export default async function NewProductPage() {
    const { categories } = await api.get<{ categories: Category[] }>("/categories");

    return (
        <div className="px-8 py-8">
            <Link
                href="/admin/products"
                className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to products
            </Link>
            <h1 className="mb-6 text-3xl font-semibold text-white">New product</h1>
            <ProductForm
                mode="create"
                categoryOptions={categories.map((c) => ({ id: c.id, name: c.name }))}
            />
        </div>
    );
}
