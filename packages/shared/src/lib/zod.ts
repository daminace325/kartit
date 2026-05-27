import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export { z };

// Reusable route-param schemas (used by validate middleware with source: "params")
export const idParamSchema = z.object({ id: z.string().min(1) });
export const slugParamSchema = z.object({ slug: z.string().min(1) });
export const productIdParamSchema = z.object({ productId: z.string().min(1) });
