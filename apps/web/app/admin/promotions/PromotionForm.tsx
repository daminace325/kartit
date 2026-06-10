"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { minorToMajor, majorToMinor, type PromotionDTO } from "@repo/shared";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ErrorBanner } from "@/components/ErrorBanner";

type Props = {
    mode: "create" | "edit";
    initial?: PromotionDTO;
};

function toLocalDatetime(iso: string | null): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
}

function formatPercent(basisPoints: string): string {
    const n = Number(basisPoints) / 100;
    if (!Number.isFinite(n)) return "";
    // Remove trailing zeros but keep at least one decimal if needed
    return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function formatFixedAmount(minor: string): string {
    try {
        return minorToMajor(minor, "USD");
    } catch {
        return "";
    }
}

export default function PromotionForm({ mode, initial }: Props) {
    const router = useRouter();

    const [code, setCode] = useState(initial?.code ?? "");
    const [type, setType] = useState<"PERCENTAGE" | "FIXED_AMOUNT">(
        (initial?.type as "PERCENTAGE" | "FIXED_AMOUNT") ?? "PERCENTAGE",
    );
    const [valueDisplay, setValueDisplay] = useState(() => {
        if (!initial) return "";
        return initial.type === "PERCENTAGE"
            ? formatPercent(initial.value)
            : formatFixedAmount(initial.value);
    });
    const [minSubtotalDisplay, setMinSubtotalDisplay] = useState(() => {
        if (!initial?.minSubtotalMinor) return "";
        try {
            return minorToMajor(initial.minSubtotalMinor, "USD");
        } catch {
            return "";
        }
    });
    const [maxUses, setMaxUses] = useState(
        initial?.maxUses != null ? String(initial.maxUses) : "",
    );
    const [maxUsesPerUser, setMaxUsesPerUser] = useState(
        initial?.maxUsesPerUser != null ? String(initial.maxUsesPerUser) : "",
    );
    const [startsAt, setStartsAt] = useState(toLocalDatetime(initial?.startsAt ?? null));
    const [endsAt, setEndsAt] = useState(toLocalDatetime(initial?.endsAt ?? null));
    const [isActive, setIsActive] = useState(initial?.isActive ?? true);

    const { execute, loading, error, setError, clearError } = useApiMutation();

    function handleTypeChange(newType: "PERCENTAGE" | "FIXED_AMOUNT") {
        setType(newType);
        setValueDisplay("");
        clearError();
    }

    async function handleSubmit(e: React.SyntheticEvent) {
        e.preventDefault();

        if (!code.trim() && mode === "create") {
            return;
        }

        let value: number;
        try {
            if (type === "PERCENTAGE") {
                const pct = parseFloat(valueDisplay);
                if (isNaN(pct) || pct <= 0 || pct > 100) {
                    throw new Error("Percentage must be between 0.01 and 100");
                }
                value = Math.round(pct * 100); // convert to basis points
            } else {
                value = Number(majorToMinor(valueDisplay, "USD"));
                if (!Number.isInteger(value) || value <= 0) {
                    throw new Error("Amount must be a positive value (e.g. 5.00)");
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            return;
        }

        let minSubtotalMinor: number | undefined;
        if (minSubtotalDisplay.trim()) {
            try {
                minSubtotalMinor = Number(majorToMinor(minSubtotalDisplay, "USD"));
            } catch {
                setError("Invalid minimum subtotal amount");
                return;
            }
        }

        const url =
            mode === "create"
                ? "/promotions"
                : `/promotions/${initial!.id}`;
        const method = mode === "create" ? "POST" : "PATCH";

        const body: Record<string, unknown> = {
            type,
            value,
            isActive,
        };
        if (mode === "create") body.code = code.trim();
        if (minSubtotalMinor != null) body.minSubtotalMinor = minSubtotalMinor;
        if (maxUses.trim()) {
            const n = Number(maxUses);
            if (!Number.isInteger(n) || n < 1) { setError("Max uses must be a positive integer"); return; }
            body.maxUses = n;
        }
        if (maxUsesPerUser.trim()) {
            const n = Number(maxUsesPerUser);
            if (!Number.isInteger(n) || n < 1) { setError("Max uses per user must be a positive integer"); return; }
            body.maxUsesPerUser = n;
        }
        if (startsAt) body.startsAt = new Date(startsAt).toISOString();
        if (endsAt) body.endsAt = new Date(endsAt).toISOString();

        const result = await execute(
            url,
            {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            },
            "Failed to save promotion",
        );
        if (!result.ok) return;

        router.push("/admin/promotions");
        router.refresh();
    }

    const valueLabel = type === "PERCENTAGE" ? "Discount %" : "Discount amount (USD)";
    const valueHint = type === "PERCENTAGE"
        ? "e.g. 10 = 10% off"
        : "e.g. 5.00 = $5.00 off";

    return (
        <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
            <ErrorBanner message={error} />

            {mode === "create" && (
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-200">
                        Code
                    </label>
                    <input
                        type="text"
                        required
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        maxLength={30}
                        pattern="^[A-Za-z0-9_-]+$"
                        className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    />
                    <p className="mt-1 text-xs text-slate-400">
                        3-30 characters. Letters, numbers, hyphens, underscores.
                    </p>
                </div>
            )}

            <div>
                <label className="mb-1 block text-sm font-medium text-slate-200">
                    Type
                </label>
                <select
                    value={type}
                    onChange={(e) => handleTypeChange(e.target.value as "PERCENTAGE" | "FIXED_AMOUNT")}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED_AMOUNT">Fixed amount ($)</option>
                </select>
            </div>

            <div>
                <label className="mb-1 block text-sm font-medium text-slate-200">
                    {valueLabel}
                </label>
                <input
                    type="number"
                    min="0"
                    step={type === "PERCENTAGE" ? "0.01" : "0.01"}
                    required
                    value={valueDisplay}
                    onChange={(e) => setValueDisplay(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
                <p className="mt-1 text-xs text-slate-400">{valueHint}</p>
            </div>

            <div>
                <label className="mb-1 block text-sm font-medium text-slate-200">
                    Minimum subtotal (optional)
                </label>
                <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={minSubtotalDisplay}
                    onChange={(e) => setMinSubtotalDisplay(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
                <p className="mt-1 text-xs text-slate-400">
                    e.g. 50.00 = customer must spend at least $50.00
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-200">
                        Max total uses (optional)
                    </label>
                    <input
                        type="number"
                        min="1"
                        step="1"
                        value={maxUses}
                        onChange={(e) => setMaxUses(e.target.value)}
                        className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-200">
                        Max uses per user (optional)
                    </label>
                    <input
                        type="number"
                        min="1"
                        step="1"
                        value={maxUsesPerUser}
                        onChange={(e) => setMaxUsesPerUser(e.target.value)}
                        className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-200">
                        Start date (optional)
                    </label>
                    <input
                        type="datetime-local"
                        value={startsAt}
                        onChange={(e) => setStartsAt(e.target.value)}
                        className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-200">
                        End date (optional)
                    </label>
                    <input
                        type="datetime-local"
                        value={endsAt}
                        onChange={(e) => setEndsAt(e.target.value)}
                        className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    />
                </div>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 accent-sky-500"
                />
                Active
            </label>

            <div className="flex gap-3 pt-2">
                <button
                    type="submit"
                    disabled={loading}
                    className="rounded bg-sky-500 px-4 py-2 font-medium text-white hover:bg-sky-400 disabled:opacity-60"
                >
                    {loading
                        ? "Saving..."
                        : mode === "create"
                          ? "Create promotion"
                          : "Save changes"}
                </button>
                <button
                    type="button"
                    onClick={() => router.push("/admin/promotions")}
                    className="rounded border border-slate-700 px-4 py-2 font-medium text-slate-200 hover:bg-slate-800"
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}
