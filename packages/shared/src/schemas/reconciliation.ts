import { z } from "../lib/zod";

export const reconciliationListQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ReconciliationListQuery = z.infer<typeof reconciliationListQuerySchema>;
