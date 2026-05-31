import { prisma } from "@repo/db";
import type { Prisma } from "@repo/db";

export interface AccountBalance {
    account: string;
    totalDebit: string;   // BigInt → string for JSON
    totalCredit: string;
    balance: string;       // DEBIT − CREDIT (assets) or CREDIT − DEBIT (revenue)
    entryCount: number;
}

export interface LedgerSummary {
    accounts: AccountBalance[];
    totalDebit: string;
    totalCredit: string;
}

async function aggregate(
    where: Prisma.LedgerEntryWhereInput,
): Promise<AccountBalance[]> {
    // Use Prisma's groupBy to aggregate per account.
    // LedgerDirection is an enum — cast fields to get raw sums.
    const entries = await prisma.ledgerEntry.findMany({
        where,
        select: {
            account: true,
            direction: true,
            amountMinor: true,
        },
        orderBy: { account: "asc" },
    });

    const map = new Map<string, { totalDebit: bigint; totalCredit: bigint; entryCount: number }>();

    for (const e of entries) {
        let acc = map.get(e.account);
        if (!acc) {
            acc = { totalDebit: 0n, totalCredit: 0n, entryCount: 0 };
            map.set(e.account, acc);
        }
        if (e.direction === "DEBIT") {
            acc.totalDebit += e.amountMinor;
        } else {
            acc.totalCredit += e.amountMinor;
        }
        acc.entryCount += 1;
    }

    return Array.from(map.entries()).map(([account, a]) => {
        // Convention: assets (CASH) balance = debits − credits;
        //             revenue/liability balance = credits − debits.
        const isAssetOrExpense = account === "CASH" || account === "REFUNDS" || account === "FEES";

        const balance = isAssetOrExpense
            ? a.totalDebit - a.totalCredit
            : a.totalCredit - a.totalDebit;

        return {
            account,
            totalDebit: a.totalDebit.toString(),
            totalCredit: a.totalCredit.toString(),
            balance: balance.toString(),
            entryCount: a.entryCount,
        };
    });
}

export const ledgerService = {
    /**
     * Returns a per-account balance summary. Filters by optional date range.
     */
    async summary(startDate?: string, endDate?: string): Promise<LedgerSummary> {
        const where: Prisma.LedgerEntryWhereInput = {};
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }

        const accounts = await aggregate(where);

        const totalDebit = accounts.reduce((sum, a) => sum + BigInt(a.totalDebit), 0n);
        const totalCredit = accounts.reduce((sum, a) => sum + BigInt(a.totalCredit), 0n);

        return {
            accounts,
            totalDebit: totalDebit.toString(),
            totalCredit: totalCredit.toString(),
        };
    },

    /**
     * Returns detailed ledger entries with optional date and account filters,
     * cursor-paginated.
     */
    async entries(
        account?: string,
        startDate?: string,
        endDate?: string,
        cursor?: string,
        limit = 50,
    ): Promise<{ items: unknown[]; nextCursor: string | null }> {
        const where: Prisma.LedgerEntryWhereInput = {};
        if (account) where.account = account;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }

        const rows = await prisma.ledgerEntry.findMany({
            where,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });

        const hasNext = rows.length > limit;
        const items = (hasNext ? rows.slice(0, limit) : rows).map((e) => ({
            id: e.id,
            account: e.account,
            direction: e.direction,
            amountMinor: e.amountMinor.toString(),
            orderId: e.orderId,
            reference: e.reference,
            memo: e.memo,
            createdAt: e.createdAt.toISOString(),
        }));
        const nextCursor = hasNext ? items[items.length - 1].id : null;

        return { items, nextCursor };
    },
};
