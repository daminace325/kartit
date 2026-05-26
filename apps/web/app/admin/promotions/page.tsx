import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { api } from "@/services/apiClient";
import { formatMoney, type PromotionListResponse, type PromotionDTO } from "@repo/shared";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

function formatValue(p: PromotionDTO): string {
    if (p.type === "PERCENTAGE") {
        const pct = Number(p.value) / 100;
        return `${pct}%`;
    }
    return formatMoney(p.value, "USD");
}

function formatMinSubtotal(p: PromotionDTO): string {
    if (!p.minSubtotalMinor) return "—";
    return formatMoney(p.minSubtotalMinor, "USD");
}

export default async function AdminPromotionsPage() {
    const { items } = await api.get<PromotionListResponse>("/promotions?limit=50");

    return (
        <div className="px-8 py-8">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-semibold text-white">Promotions</h1>
                    <p className="mt-1 text-sm text-slate-400">
                        {items.length} {items.length === 1 ? "promotion" : "promotions"}
                    </p>
                </div>
                <Link
                    href="/admin/promotions/new"
                    className="inline-flex items-center gap-2 rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400"
                >
                    <Plus className="h-4 w-4" />
                    New promotion
                </Link>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                {items.length === 0 ? (
                    <p className="p-8 text-center text-sm text-slate-400">
                        No promotions yet. Create your first one.
                    </p>
                ) : (
                    <table className="w-full">
                        <thead className="border-b border-slate-800 bg-slate-900/50 text-left text-xs uppercase tracking-wide text-slate-400">
                            <tr>
                                <th className="px-4 py-3 font-medium">Code</th>
                                <th className="px-4 py-3 font-medium">Type</th>
                                <th className="px-4 py-3 font-medium">Value</th>
                                <th className="px-4 py-3 font-medium">Min. Subtotal</th>
                                <th className="px-4 py-3 font-medium">Uses</th>
                                <th className="px-4 py-3 font-medium">Dates</th>
                                <th className="px-4 py-3 font-medium">Active</th>
                                <th className="px-4 py-3 text-right font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-sm">
                            {items.map((p) => (
                                <tr key={p.id} className="hover:bg-slate-800/40">
                                    <td className="px-4 py-3">
                                        <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs font-medium text-white">
                                            {p.code}
                                        </code>
                                    </td>
                                    <td className="px-4 py-3 text-slate-300">
                                        {p.type === "PERCENTAGE" ? "Percentage" : "Fixed amount"}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-white">
                                        {formatValue(p)}
                                    </td>
                                    <td className="px-4 py-3 text-slate-400">
                                        {formatMinSubtotal(p)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="rounded bg-slate-700/50 px-2 py-0.5 text-xs font-medium text-slate-300">
                                            {p.usedCount}
                                            {p.maxUses != null ? ` / ${p.maxUses}` : ""}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-400">
                                        {p.startsAt || p.endsAt ? (
                                            <span>
                                                {p.startsAt ? formatDate(p.startsAt) : "—"}
                                                {" → "}
                                                {p.endsAt ? formatDate(p.endsAt) : "—"}
                                            </span>
                                        ) : (
                                            "Always"
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {p.isActive ? (
                                            <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
                                                Yes
                                            </span>
                                        ) : (
                                            <span className="rounded bg-slate-700/30 px-2 py-0.5 text-xs font-medium text-slate-400">
                                                No
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end">
                                            <Link
                                                href={`/admin/promotions/${p.id}/edit`}
                                                className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
                                            >
                                                <Pencil className="h-4 w-4" />
                                                Edit
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
