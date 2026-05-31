import { z } from "../lib/zod";

const slug = z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be kebab-case");

// One image attached to a product (Cloudinary-hosted).
// `position` is assigned server-side from the array index, so the client
// just submits images in the order it wants them displayed.
const productImageInputSchema = z.object({
    url: z.url(),
    publicId: z.string().min(1).max(200),
    alt: z.string().max(200).optional(),
});

export const productCreateSchema = z.object({
    slug,
    sku: z.string().min(1).max(50),
    name: z.string().min(1).max(120),
    description: z.string().min(1).max(4000),
    // Money: minor units as integer
    priceMinor: z.coerce.number().int().nonnegative(),
    currency: z.string().length(3),
    stock: z.coerce.number().int().nonnegative().default(0),
    isActive: z.boolean().default(true),
    categoryId: z.string().min(1),
    // Up to 6 images. Actual upload flow lands in 1.5; schema is ready now.
    images: z.array(productImageInputSchema).max(6).default([]),
});
export type ProductCreateInput = z.infer<typeof productCreateSchema>;

export const productUpdateSchema = productCreateSchema.partial();
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

export const productListQuerySchema = z.object({
    q: z.string().optional(),
    categoryId: z.string().optional(),
    // Comma-separated list of category ids. Useful for browsing a parent
    // category that should also include products from its subcategories.
    categoryIds: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

// Wire DTOs (BigInt -> string at the JSON boundary).
export type ProductImageDTO = {
    id: string;
    url: string;
    publicId: string;
    alt: string | null;
    position: number;
};

export type ProductDTO = {
    id: string;
    slug: string;
    sku: string;
    name: string;
    description: string;
    priceMinor: string;
    currency: string;
    stock: number;
    isActive: boolean;
    categoryId: string;
    images: ProductImageDTO[];
};
