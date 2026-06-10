import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { api, ApiClientError } from "@/services/apiClient";
import { formatMoney, type CategoryDTO, type ProductDTO } from "@repo/shared";
import { productImageUrl } from "@/lib/image";
import ProductGallery from "@/components/ProductGallery";
import AddToCart from "@/components/AddToCart";

export const dynamic = "force-dynamic";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;

    let product: ProductDTO;
    try {
        ({ product } = await api.get<{ product: ProductDTO }>(
            `/products/slug/${encodeURIComponent(slug)}`,
        ));
    } catch {
        return { title: "Product not found" };
    }

    const description =
        product.description.length > 200
            ? product.description.slice(0, 197) + "..."
            : product.description;

    const cover = [...product.images].sort((a, b) => a.position - b.position)[0];
    const ogImage = productImageUrl(cover, "card");

    return {
        title: product.name,
        description,
        openGraph: {
            title: product.name,
            description,
            ...(ogImage && { images: [{ url: ogImage, width: 400, height: 400 }] }),
        },
    };
}

export default async function ProductDetailPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;

    let product: ProductDTO;
    try {
        ({ product } = await api.get<{ product: ProductDTO }>(
            `/products/slug/${encodeURIComponent(slug)}`,
        ));
    } catch (err) {
        if (err instanceof ApiClientError && err.status === 404) notFound();
        throw err;
    }

    const category = await api
        .get<{ category: CategoryDTO }>(`/categories/${encodeURIComponent(product.categoryId)}`)
        .then((r) => r.category)
        .catch(() => null);

    return (
        <div>
            <nav className="mb-6 flex items-center gap-1 text-sm text-slate-400">
                <Link href="/" className="hover:text-white">
                    Home
                </Link>
                {category && (
                    <>
                        <ChevronRight className="h-4 w-4" />
                        <Link href={`/c/${category.slug}`} className="hover:text-white">
                            {category.name}
                        </Link>
                    </>
                )}
                <ChevronRight className="h-4 w-4" />
                <span className="truncate text-slate-300">{product.name}</span>
            </nav>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <ProductGallery images={product.images} title={product.name} />

                <div className="flex flex-col">
                    <h1 className="text-3xl font-semibold text-white">{product.name}</h1>

                    <div className="mt-6 flex items-baseline gap-3">
                        <span className="text-3xl font-bold text-white">
                            {formatMoney(product.priceMinor, product.currency)}
                        </span>
                    </div>

                    <div className="mt-6 border-t border-slate-800 pt-6">
                        <AddToCart productId={product.id} stock={product.stock} />
                    </div>

                    {product.description && (
                        <div className="mt-8 border-t border-slate-800 pt-6">
                            <h2 className="mb-3 text-lg font-semibold text-white">
                                Description
                            </h2>
                            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
                                {product.description}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
