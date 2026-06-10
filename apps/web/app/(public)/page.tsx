import Link from "next/link";
import { api } from "@/services/apiClient";
import type { CategoryDTO, ProductDTO } from "@repo/shared";
import ProductCard from "@/components/ProductCard";
type ProductList = { items: ProductDTO[]; nextCursor: string | null };

export const dynamic = "force-dynamic";

const TOP_CATEGORY_LIMIT = 6;
const PRODUCTS_PER_CATEGORY = 8;

export default async function HomePage() {
    // All categories so we can resolve each top-level category's children.
    const { categories: allCategories } = await api
        .get<{ categories: CategoryDTO[] }>("/categories")
        .catch(() => ({ categories: [] as CategoryDTO[] }));

    const childrenByParent = new Map<string, string[]>();
    for (const c of allCategories) {
        if (!c.parentId) continue;
        const arr = childrenByParent.get(c.parentId) ?? [];
        arr.push(c.id);
        childrenByParent.set(c.parentId, arr);
    }

    const topCategories = allCategories
        .filter((c) => !c.parentId)
        .slice(0, TOP_CATEGORY_LIMIT);

    // For each top-level category, fetch the latest N products (including
    // products from its subcategories).
    const sections = await Promise.all(
        topCategories.map(async (cat) => {
            const ids = [cat.id, ...(childrenByParent.get(cat.id) ?? [])];
            const { items } = await api
                .get<ProductList>(
                    `/products?categoryIds=${encodeURIComponent(
                        ids.join(","),
                    )}&limit=${PRODUCTS_PER_CATEGORY}`,
                )
                .catch(() => ({ items: [] as ProductDTO[], nextCursor: null }));
            return { category: cat, items };
        }),
    );

    const visibleSections = sections.filter((s) => s.items.length > 0);

    return (
        <div className="space-y-8">
            {visibleSections.length === 0 ? (
                <div className="rounded-md border border-slate-700 bg-slate-800 p-10 text-center text-slate-400">
                    No products yet. Add some via the admin to populate the storefront.
                </div>
            ) : (
                visibleSections.map(({ category, items }) => (
                    <section
                        key={category.id}
                        className="p-4 shadow-sm"
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-white">{category.name}</h2>
                            <Link
                                href={`/c/${category.slug}`}
                                className="text-sm text-sky-400 hover:underline"
                            >
                                See all →
                            </Link>
                        </div>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                            {items.map((p) => (
                                <ProductCard key={p.id} product={p} />
                            ))}
                        </div>
                    </section>
                ))
            )}
        </div>
    );
}
