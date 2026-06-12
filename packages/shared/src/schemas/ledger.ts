import { z } from "../lib/zod";

export const ledgerEntriesQuerySchema = z.object({
    account: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type LedgerEntriesQuery = z.infer<typeof ledgerEntriesQuerySchema>;
