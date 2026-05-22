import Link from "next/link";
import { notFound } from "next/navigation";
import { api, ApiClientError } from "@/services/apiClient";
import type { ProductDTO } from "@repo/shared";
import ProductCard from "@/components/ProductCard";

type Category = { id: string; slug: string; name: string; parentId: string | null };
type ProductList = { items: ProductDTO[]; nextCursor: string | null };

export const dynamic = "force-dynamic";

export default async function CategoryPage({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ cursor?: string }>;
}) {
    const { slug } = await params;
    const sp = await searchParams;

    let category: Category;
    try {
        ({ category } = await api.get<{ category: Category }>(
            `/categories/slug/${encodeURIComponent(slug)}`,
        ));
    } catch (err) {
        if (err instanceof ApiClientError && err.status === 404) notFound();
        throw err;
    }

    // For a top-level category include its subcategories' products too.
    const { categories: children } = await api
        .get<{ categories: Category[] }>(
            `/categories?parentId=${encodeURIComponent(category.id)}`,
        )
        .catch(() => ({ categories: [] as Category[] }));

    const ids = [category.id, ...children.map((c) => c.id)];

    const parent = category.parentId
        ? await api
              .get<{ category: Category }>(
                  `/categories/${encodeURIComponent(category.parentId)}`,
              )
              .then((r) => r.category)
              .catch(() => null)
        : null;

    const cursorQs = sp.cursor ? `&cursor=${encodeURIComponent(sp.cursor)}` : "";
    const { items, nextCursor } = await api.get<ProductList>(
        `/products?categoryIds=${encodeURIComponent(ids.join(","))}&limit=24${cursorQs}`,
    );

    return (
        <div>
            <nav className="text-sm text-slate-400">
                <Link href="/" className="hover:text-sky-400">
                    Home
                </Link>
                {parent && (
                    <>
                        <span className="mx-2 text-slate-600">/</span>
                        <Link href={`/c/${parent.slug}`} className="hover:text-sky-400">
                            {parent.name}
                        </Link>
                    </>
                )}
                <span className="mx-2 text-slate-600">/</span>
                <span className="text-slate-300">{category.name}</span>
            </nav>

            <h1 className="mt-3 text-3xl font-semibold text-white">{category.name}</h1>

            {children.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                    {children.map((c) => (
                        <Link
                            key={c.id}
                            href={`/c/${c.slug}`}
                            className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-200 hover:border-sky-500 hover:text-sky-300"
                        >
                            {c.name}
                        </Link>
                    ))}
                </div>
            )}

            {items.length === 0 ? (
                <div className="mt-10 rounded-md border border-slate-700 bg-slate-800 p-10 text-center text-slate-400">
                    No products in this category yet.
                </div>
            ) : (
                <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {items.map((p) => (
                        <ProductCard key={p.id} product={p} />
                    ))}
                </div>
            )}

            {nextCursor && (
                <div className="mt-10 flex justify-center">
                    <Link
                        href={`/c/${slug}?cursor=${encodeURIComponent(nextCursor)}`}
                        className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
                    >
                        Load more →
                    </Link>
                </div>
            )}
        </div>
    );
}
