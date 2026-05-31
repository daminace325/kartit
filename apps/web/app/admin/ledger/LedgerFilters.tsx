"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, type FormEvent } from "react";
import { Search, RotateCcw } from "lucide-react";

const ACCOUNTS = [
    { value: "", label: "All accounts" },
    { value: "CASH", label: "Cash" },
    { value: "REVENUE", label: "Revenue" },
    { value: "REFUNDS", label: "Refunds" },
    { value: "FEES", label: "Fees" },
    { value: "TAX", label: "Tax" },
];

export default function LedgerFilters() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const formRef = useRef<HTMLFormElement>(null);

    const account = searchParams.get("account") ?? "";
    const startDate = searchParams.get("startDate") ?? "";
    const endDate = searchParams.get("endDate") ?? "";

    const handleSubmit = useCallback(
        (e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const params = new URLSearchParams();

            const a = (data.get("account") as string)?.trim();
            const s = (data.get("startDate") as string)?.trim();
            const ed = (data.get("endDate") as string)?.trim();

            if (a) params.set("account", a);
            if (s) params.set("startDate", s);
            if (ed) params.set("endDate", ed);

            router.push(`/admin/ledger?${params.toString()}`);
        },
        [router],
    );

    const handleReset = useCallback(() => {
        formRef.current?.reset();
        router.push("/admin/ledger");
    }, [router]);

    const hasFilters = account || startDate || endDate;

    return (
        <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="flex flex-wrap items-end gap-3"
        >
            <div className="flex flex-col gap-1">
                <label
                    htmlFor="account"
                    className="text-xs font-medium uppercase tracking-wide text-slate-500"
                >
                    Account
                </label>
                <select
                    id="account"
                    name="account"
                    defaultValue={account}
                    className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                    {ACCOUNTS.map((a) => (
                        <option key={a.value} value={a.value}>
                            {a.label}
                        </option>
                    ))}
                </select>
            </div>

            <div className="flex flex-col gap-1">
                <label
                    htmlFor="startDate"
                    className="text-xs font-medium uppercase tracking-wide text-slate-500"
                >
                    From
                </label>
                <input
                    id="startDate"
                    name="startDate"
                    type="date"
                    defaultValue={startDate}
                    className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 [color-scheme:dark]"
                />
            </div>

            <div className="flex flex-col gap-1">
                <label
                    htmlFor="endDate"
                    className="text-xs font-medium uppercase tracking-wide text-slate-500"
                >
                    To
                </label>
                <input
                    id="endDate"
                    name="endDate"
                    type="date"
                    defaultValue={endDate}
                    className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 [color-scheme:dark]"
                />
            </div>

            <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400"
            >
                <Search className="h-4 w-4" />
                Filter
            </button>

            {hasFilters && (
                <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500 hover:text-white"
                >
                    <RotateCcw className="h-4 w-4" />
                    Reset
                </button>
            )}
        </form>
    );
}
