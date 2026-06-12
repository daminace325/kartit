import { z } from "../lib/zod";

export const PromotionType = {
    PERCENTAGE: "PERCENTAGE",
    FIXED_AMOUNT: "FIXED_AMOUNT",
} as const;
export type PromotionType = (typeof PromotionType)[keyof typeof PromotionType];

export const promotionCreateSchema = z.object({
    code: z
        .string()
        .min(3)
        .max(30)
        .regex(/^[A-Za-z0-9_-]+$/, "Only letters, numbers, hyphens, and underscores"),
    type: z.enum([PromotionType.PERCENTAGE, PromotionType.FIXED_AMOUNT]),
    value: z.coerce.bigint().positive(),
    minSubtotalMinor: z.coerce.bigint().positive().optional(),
    maxUses: z.coerce.number().int().positive().optional(),
    maxUsesPerUser: z.coerce.number().int().positive().optional(),
    startsAt: z.iso.datetime().optional(),
    endsAt: z.iso.datetime().optional(),
    isActive: z.boolean().default(true),
});
export type PromotionCreateInput = z.infer<typeof promotionCreateSchema>;

export const promotionUpdateSchema = promotionCreateSchema.partial().omit({ code: true });
export type PromotionUpdateInput = z.infer<typeof promotionUpdateSchema>;

export type PromotionDTO = {
    id: string;
    code: string;
    type: PromotionType;
    value: string;
    minSubtotalMinor: string | null;
    maxUses: number | null;
    maxUsesPerUser: number | null;
    usedCount: number;
    startsAt: string | null;
    endsAt: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
};

export const promotionListQuerySchema = z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type PromotionListQuery = z.infer<typeof promotionListQuerySchema>;

export type PromotionListResponse = {
    items: PromotionDTO[];
    nextCursor: string | null;
};
