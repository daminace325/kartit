import { z } from "zod";

const slug = z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be kebab-case");

export const categoryCreateSchema = z.object({
    slug,
    name: z.string().min(1).max(80),
    parentId: z.string().min(1).nullish(),
});
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;

export const categoryUpdateSchema = categoryCreateSchema.partial();
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;

export const categoryListQuerySchema = z.object({
    // "null" / "" — only top-level. Otherwise filter by exact parentId.
    parentId: z.string().optional(),
});
export type CategoryListQuery = z.infer<typeof categoryListQuerySchema>;
