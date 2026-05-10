import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import type { ProductDTO } from "@repo/shared";
import ProductForm from "../../ProductForm";

export const dynamic = "force-dynamic";

type Category = { id: string; slug: string; name: string };

export default async function EditProductPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    let product: ProductDTO;
    try {
        ({ product } = await api.get<{ product: ProductDTO }>(
            `/products/${encodeURIComponent(id)}`,
        ));
    } catch (err) {
        if (err instanceof ApiClientError && err.status === 404) notFound();
        throw err;
    }

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
            <h1 className="mb-6 text-3xl font-semibold text-white">Edit product</h1>
            <ProductForm
                mode="edit"
                initial={product}
                categoryOptions={categories.map((c) => ({ id: c.id, name: c.name }))}
            />
        </div>
    );
}
