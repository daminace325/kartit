import Link from "next/link";
import { api } from "@/lib/api";
import type { ProductDTO } from "@repo/shared";
import ProductCard from "@/components/ProductCard";

type ProductList = { items: ProductDTO[]; nextCursor: string | null };

export const dynamic = "force-dynamic";

export default async function SearchPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; cursor?: string }>;
}) {
    const sp = await searchParams;
    const q = (sp.q ?? "").trim();

    if (!q) {
        return (
            <div className="rounded-md border border-slate-700 bg-slate-800 p-10 text-center text-slate-400">
                Type a search term in the bar above to find products.
            </div>
        );
    }

    const cursorQs = sp.cursor ? `&cursor=${encodeURIComponent(sp.cursor)}` : "";
    const { items, nextCursor } = await api.get<ProductList>(
        `/products?q=${encodeURIComponent(q)}&limit=24${cursorQs}`,
    );

    return (
        <div>
            <h1 className="text-2xl font-semibold text-white">
                Results for <span className="text-sky-400">&ldquo;{q}&rdquo;</span>
            </h1>

            {items.length === 0 ? (
                <div className="mt-6 rounded-md border border-slate-700 bg-slate-800 p-10 text-center text-slate-400">
                    No products matched your search.
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
                        href={`/search?q=${encodeURIComponent(q)}&cursor=${encodeURIComponent(nextCursor)}`}
                        className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
                    >
                        Load more →
                    </Link>
                </div>
            )}
        </div>
    );
}
