import type { MetadataRoute } from "next";
import { api } from "@/services/apiClient";

const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

type ProductRef = { slug: string };
type CategoryRef = { slug: string };

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const now = new Date();

    const staticPages: MetadataRoute.Sitemap = [
        { url: SITE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
        { url: `${SITE_URL}/search`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
    ];

    // Products — paginate through all active products.
    const productEntries: MetadataRoute.Sitemap = [];
    let cursor: string | undefined;
    let hasMore = true;
    while (hasMore) {
        const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=50` : "?limit=50";
        const data = await api
            .get<{ items: ProductRef[]; nextCursor: string | null }>(`/products${qs}`)
            .catch(
                (): { items: ProductRef[]; nextCursor: null } => ({
                    items: [],
                    nextCursor: null,
                }),
            );
        for (const p of data.items) {
            productEntries.push({
                url: `${SITE_URL}/p/${encodeURIComponent(p.slug)}`,
                lastModified: now,
                changeFrequency: "weekly",
                priority: 0.8,
            });
        }
        if (data.nextCursor) {
            cursor = data.nextCursor;
        } else {
            hasMore = false;
        }
    }

    // Categories.
    const { categories } = await api
        .get<{ categories: CategoryRef[] }>("/categories")
        .catch(() => ({ categories: [] as CategoryRef[] }));
    const categoryEntries: MetadataRoute.Sitemap = categories.map((c) => ({
        url: `${SITE_URL}/c/${encodeURIComponent(c.slug)}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.7,
    }));

    return [...staticPages, ...categoryEntries, ...productEntries];
}
