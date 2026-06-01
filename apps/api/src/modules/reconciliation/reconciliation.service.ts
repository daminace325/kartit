import { prisma } from "@repo/db";

export interface ReconciliationReportDTO {
    id: string;
    runAt: string;
    startCursor: string | null;
    endCursor: string | null;
    totalStripeAmount: string;
    totalLedgerAmount: string;
    driftMinor: string;
    transactionCount: number;
    matchedCount: number;
    mismatchedRefs: unknown;
    createdAt: string;
}

export const reconciliationService = {
    /**
     * Returns recent reconciliation reports, most recent first.
     */
    async list(limit = 20): Promise<ReconciliationReportDTO[]> {
        const reports = await prisma.reconciliationReport.findMany({
            orderBy: { runAt: "desc" },
            take: Math.min(limit, 100),
        });

        return reports.map((r) => ({
            id: r.id,
            runAt: r.runAt.toISOString(),
            startCursor: r.startCursor,
            endCursor: r.endCursor,
            totalStripeAmount: r.totalStripeAmount.toString(),
            totalLedgerAmount: r.totalLedgerAmount.toString(),
            driftMinor: r.driftMinor.toString(),
            transactionCount: r.transactionCount,
            matchedCount: r.matchedCount,
            mismatchedRefs: r.mismatchedRefs,
            createdAt: r.createdAt.toISOString(),
        }));
    },

    /**
     * Returns a single reconciliation report by ID.
     */
    async getById(id: string): Promise<ReconciliationReportDTO | null> {
        const report = await prisma.reconciliationReport.findUnique({
            where: { id },
        });

        if (!report) return null;

        return {
            id: report.id,
            runAt: report.runAt.toISOString(),
            startCursor: report.startCursor,
            endCursor: report.endCursor,
            totalStripeAmount: report.totalStripeAmount.toString(),
            totalLedgerAmount: report.totalLedgerAmount.toString(),
            driftMinor: report.driftMinor.toString(),
            transactionCount: report.transactionCount,
            matchedCount: report.matchedCount,
            mismatchedRefs: report.mismatchedRefs,
            createdAt: report.createdAt.toISOString(),
        };
    },
};
