import Link from "next/link";
import { api } from "@/services/apiClient";
import { formatMoney } from "@repo/shared";
import { formatDate, formatDateTime } from "@/lib/dates";
import LedgerFilters from "./LedgerFilters";
import {
    Banknote,
    ArrowDownCircle,
    ArrowUpCircle,
    RotateCcw,
    Receipt,
} from "lucide-react";
import CursorPagination from "@/components/CursorPagination";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Types (inline — matching the refund-requests page pattern)
// ---------------------------------------------------------------------------

interface AccountBalance {
    account: string;
    totalDebit: string;
    totalCredit: string;
    balance: string;
    entryCount: number;
}

interface LedgerSummary {
    accounts: AccountBalance[];
    totalDebit: string;
    totalCredit: string;
}

interface LedgerEntryItem {
    id: string;
    account: string;
    direction: "DEBIT" | "CREDIT";
    amountMinor: string;
    orderId: string | null;
    paymentId?: string | null;
    reference: string | null;
    memo: string | null;
    createdAt: string;
}

interface LedgerEntriesResponse {
    items: LedgerEntryItem[];
    nextCursor: string | null;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const ACCOUNT_LABELS: Record<string, string> = {
    CASH: "Cash",
    REVENUE: "Revenue",
    REFUNDS: "Refunds",
    FEES: "Fees",
    TAX: "Tax",
};

const ACCOUNT_COLORS: Record<string, string> = {
    CASH: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    REVENUE: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    REFUNDS: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    FEES: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    TAX: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

const ACCOUNT_ICON: Record<string, React.ReactNode> = {
    CASH: <Banknote className="h-5 w-5 text-emerald-400" />,
    REVENUE: <ArrowUpCircle className="h-5 w-5 text-sky-400" />,
    REFUNDS: <RotateCcw className="h-5 w-5 text-amber-400" />,
    FEES: <ArrowDownCircle className="h-5 w-5 text-purple-400" />,
    TAX: <Receipt className="h-5 w-5 text-slate-400" />,
};

function accountLabel(account: string): string {
    return ACCOUNT_LABELS[account] ?? account;
}

function accountColor(account: string): string {
    return ACCOUNT_COLORS[account] ?? "bg-slate-500/15 text-slate-300 border-slate-500/30";
}

function isPositiveBalance(account: string, balance: bigint): boolean {
    // Asset/expense accounts: positive = DEBIT > CREDIT (balance >= 0)
    // Revenue accounts: positive = CREDIT > DEBIT (balance >= 0)
    // The backend already computes it correctly, so just check >= 0
    return balance >= 0n;
}

function entryAmountClass(direction: "DEBIT" | "CREDIT"): string {
    return direction === "DEBIT" ? "text-emerald-400" : "text-red-400";
}

function entrySign(direction: "DEBIT" | "CREDIT"): string {
    return direction === "DEBIT" ? "+" : "−";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminLedgerPage({
    searchParams,
}: {
    searchParams: Promise<{
        account?: string;
        startDate?: string;
        endDate?: string;
        cursor?: string;
    }>;
}) {
    const sp = await searchParams;

    // Build query strings for both API calls
    const summaryParams = new URLSearchParams();
    if (sp.startDate) summaryParams.set("startDate", sp.startDate);
    if (sp.endDate) summaryParams.set("endDate", sp.endDate);

    const entriesParams = new URLSearchParams();
    if (sp.account) entriesParams.set("account", sp.account);
    if (sp.startDate) entriesParams.set("startDate", sp.startDate);
    if (sp.endDate) entriesParams.set("endDate", sp.endDate);
    if (sp.cursor) entriesParams.set("cursor", sp.cursor);
    entriesParams.set("limit", "50");

    // Fetch summary and entries in parallel
    const [summary, entriesData] = await Promise.all([
        api
            .get<LedgerSummary>(
                `/admin/ledger?${summaryParams.toString()}`,
            )
            .catch(() => null),
        api
            .get<LedgerEntriesResponse>(
                `/admin/ledger/entries?${entriesParams.toString()}`,
            )
            .catch(() => null),
    ]);

    const accounts = summary?.accounts ?? [];
    const items = entriesData?.items ?? [];
    const nextCursor = entriesData?.nextCursor ?? null;

    // Build "load more" URL preserving all current filters
    const loadMoreParams = new URLSearchParams();
    if (sp.account) loadMoreParams.set("account", sp.account);
    if (sp.startDate) loadMoreParams.set("startDate", sp.startDate);
    if (sp.endDate) loadMoreParams.set("endDate", sp.endDate);
    if (nextCursor) loadMoreParams.set("cursor", nextCursor);

    return (
        <div className="px-8 py-8">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-semibold text-white">
                        Ledger
                    </h1>
                    <p className="mt-1 text-sm text-slate-400">
                        Double-entry records for every payment, refund, and fee
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="mb-8">
                <LedgerFilters />
            </div>

            {/* Summary cards */}
            <section className="mb-8">
                <h2 className="mb-4 text-lg font-semibold text-white">
                    Account Balances
                </h2>

                {accounts.length === 0 ? (
                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-400">
                        No ledger entries found
                        {sp.startDate || sp.endDate
                            ? " for the selected date range."
                            : "."}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        {accounts.map((acc) => {
                            const bal = BigInt(acc.balance);
                            const positive = isPositiveBalance(acc.account, bal);
                            return (
                                <div
                                    key={acc.account}
                                    className="rounded-lg border border-slate-800 bg-slate-900 p-5"
                                >
                                    <div className="mb-3 flex items-center gap-3">
                                        {ACCOUNT_ICON[acc.account] ?? (
                                            <div className="h-5 w-5 rounded bg-slate-700" />
                                        )}
                                        <span
                                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${accountColor(acc.account)}`}
                                        >
                                            {accountLabel(acc.account)}
                                        </span>
                                    </div>

                                    <div className="mb-2">
                                        <p className="text-xs uppercase tracking-wide text-slate-500">
                                            Balance
                                        </p>
                                        <p
                                            className={`text-xl font-semibold ${positive ? "text-white" : "text-red-400"}`}
                                        >
                                            {formatMoney(
                                                bal < 0n ? -bal : bal,
                                                "USD",
                                            )}
                                            {!positive && (
                                                <span className="ml-1 text-xs">
                                                    DR
                                                </span>
                                            )}
                                        </p>
                                    </div>

                                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-800 pt-3">
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-slate-500">
                                                Debits
                                            </p>
                                            <p className="text-sm font-medium text-emerald-400">
                                                {formatMoney(
                                                    acc.totalDebit,
                                                    "USD",
                                                )}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-slate-500">
                                                Credits
                                            </p>
                                            <p className="text-sm font-medium text-red-400">
                                                {formatMoney(
                                                    acc.totalCredit,
                                                    "USD",
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-2">
                                        <p className="text-xs text-slate-500">
                                            {acc.entryCount}{" "}
                                            {acc.entryCount === 1
                                                ? "entry"
                                                : "entries"}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Totals row */}
                {summary && accounts.length > 0 && (
                    <div className="mt-4 flex gap-6 rounded-lg border border-slate-800 bg-slate-900/50 px-5 py-3 text-sm">
                        <div>
                            <span className="text-slate-500">
                                Total debits:{" "}
                            </span>
                            <span className="font-medium text-emerald-400">
                                {formatMoney(summary.totalDebit, "USD")}
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-500">
                                Total credits:{" "}
                            </span>
                            <span className="font-medium text-red-400">
                                {formatMoney(summary.totalCredit, "USD")}
                            </span>
                        </div>
                    </div>
                )}
            </section>

            {/* Entries table */}
            <section>
                <h2 className="mb-4 text-lg font-semibold text-white">
                    Ledger Entries
                </h2>

                {items.length === 0 ? (
                    <div className="rounded-lg border border-slate-800 bg-slate-900 p-10 text-center text-sm text-slate-400">
                        No entries found
                        {sp.account && ` for account "${accountLabel(sp.account)}"`}
                        {sp.startDate || sp.endDate
                            ? " in the selected date range"
                            : ""}
                        .
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-900/60 text-left text-xs uppercase tracking-wide text-slate-400">
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Account</th>
                                    <th className="px-4 py-3">Direction</th>
                                    <th className="px-4 py-3 text-right">
                                        Amount
                                    </th>
                                    <th className="px-4 py-3">Order</th>
                                    <th className="px-4 py-3">Reference</th>
                                    <th className="px-4 py-3">Memo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {items.map((entry) => (
                                    <tr
                                        key={entry.id}
                                        className="hover:bg-slate-800/40"
                                    >
                                        <td className="px-4 py-3 text-slate-400">
                                            <span
                                                title={formatDateTime(
                                                    entry.createdAt,
                                                )}
                                            >
                                                {formatDate(entry.createdAt)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${accountColor(entry.account)}`}
                                            >
                                                {accountLabel(entry.account)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                                                    entry.direction === "DEBIT"
                                                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                                        : "border-red-500/30 bg-red-500/10 text-red-300"
                                                }`}
                                            >
                                                {entry.direction === "DEBIT"
                                                    ? "Debit"
                                                    : "Credit"}
                                            </span>
                                        </td>
                                        <td
                                            className={`px-4 py-3 text-right font-mono text-sm font-medium ${entryAmountClass(entry.direction)}`}
                                        >
                                            {entrySign(entry.direction)}{" "}
                                            {formatMoney(
                                                entry.amountMinor,
                                                "USD",
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {entry.orderId ? (
                                                <Link
                                                    href={`/admin/orders/${entry.orderId}`}
                                                    className="font-mono text-xs text-sky-400 hover:text-sky-300"
                                                >
                                                    #
                                                    {entry.orderId.slice(
                                                        0,
                                                        10,
                                                    )}
                                                    …
                                                </Link>
                                            ) : (
                                                <span className="text-slate-600">
                                                    —
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {entry.reference ? (
                                                <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">
                                                    {entry.reference.length >
                                                    20
                                                        ? `${entry.reference.slice(0, 20)}…`
                                                        : entry.reference}
                                                </code>
                                            ) : (
                                                <span className="text-slate-600">
                                                    —
                                                </span>
                                            )}
                                        </td>
                                        <td className="max-w-xs px-4 py-3 text-slate-400">
                                            {entry.memo ? (
                                                <span className="line-clamp-2">
                                                    {entry.memo}
                                                </span>
                                            ) : (
                                                <span className="text-slate-600">
                                                    —
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Load more */}
                <CursorPagination
                    nextCursor={nextCursor}
                    href={`/admin/ledger?${loadMoreParams.toString()}`}
                />
            </section>
        </div>
    );
}
