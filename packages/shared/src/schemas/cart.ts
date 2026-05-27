import { z } from "../lib/zod";

export const cartAddItemSchema = z.object({
    productId: z.string().min(1),
    quantity: z.coerce.number().int().min(1).max(99),
});
export type CartAddItemInput = z.infer<typeof cartAddItemSchema>;

export const cartUpdateItemSchema = z.object({
    quantity: z.coerce.number().int().min(0).max(99),
});
export type CartUpdateItemInput = z.infer<typeof cartUpdateItemSchema>;

export const cartSummarySchema = z.object({
    promotionCode: z.string().min(1).optional(),
});

// Wire DTOs (BigInt -> string at the JSON boundary).
export type CartItemDTO = {
    id: string;
    productId: string;
    quantity: number;
    // Snapshot of current product info (not historical).
    productSlug: string;
    productName: string;
    unitPriceMinor: string;
    currency: string;
    imageUrl: string | null;
    stock: number;
    isActive: boolean;
    lineTotalMinor: string;
};

export type CartDTO = {
    id: string;
    items: CartItemDTO[];
    currency: string;
    subtotalMinor: string;
    itemCount: number;
};

export type CartSummaryDTO = {
    cartId: string;
    items: CartItemDTO[];
    currency: string;
    subtotalMinor: string;
    discountMinor: string;
    shippingMinor: string;
    taxMinor: string;
    totalMinor: string;
    shippingNote?: string;
    taxNote?: string;
    discountNote?: string;
    promotionCode?: string;
};
