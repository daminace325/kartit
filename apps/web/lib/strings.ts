/**
 * Convert an arbitrary string into a kebab-case slug suitable for URLs.
 *   "Apple iPhone 15 Pro!" → "apple-iphone-15-pro"
 */
export function slugify(input: string): string {
    return input
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}
