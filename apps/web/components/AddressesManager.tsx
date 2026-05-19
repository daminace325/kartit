"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import type { AddressDTO, AddressInput } from "@repo/shared";
import { formatApiError } from "@/lib/errors";
import { csrfFetch } from "@/lib/csrf";
import { ErrorBanner } from "@/components/ErrorBanner";

type Mode =
    | { kind: "list" }
    | { kind: "new" }
    | { kind: "edit"; id: string };

export default function AddressesManager({
    initialAddresses,
}: {
    initialAddresses: AddressDTO[];
}) {
    const router = useRouter();
    const [addresses, setAddresses] = useState<AddressDTO[]>(initialAddresses);
    const [mode, setMode] = useState<Mode>({ kind: "list" });

    async function handleDelete(id: string) {
        if (!confirm("Delete this address?")) return;
        const res = await csrfFetch(`/api/auth/me/addresses/${id}`, {
            method: "DELETE",
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alert(formatApiError(data?.error, "Failed to delete"));
            return;
        }
        setAddresses((prev) => prev.filter((a) => a.id !== id));
        router.refresh();
    }

    async function handleSave(
        payload: AddressInput,
        id?: string,
    ): Promise<string | null> {
        const url =
            id === undefined
                ? "/api/auth/me/addresses"
                : `/api/auth/me/addresses/${id}`;
        const method = id === undefined ? "POST" : "PUT";

        const res = await csrfFetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            return formatApiError(data?.error, "Failed to save");
        }
        const saved: AddressDTO | undefined = data?.address;
        if (saved) {
            setAddresses((prev) =>
                id === undefined
                    ? [...prev, saved]
                    : prev.map((a) => (a.id === id ? saved : a)),
            );
        }
        setMode({ kind: "list" });
        router.refresh();
        return null;
    }

    if (mode.kind === "new" || mode.kind === "edit") {
        const initial =
            mode.kind === "edit"
                ? addresses.find((a) => a.id === mode.id)
                : undefined;
        return (
            <AddressForm
                initial={initial}
                onCancel={() => setMode({ kind: "list" })}
                onSubmit={(payload) =>
                    handleSave(payload, mode.kind === "edit" ? mode.id : undefined)
                }
            />
        );
    }

    return (
        <div>
            <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-slate-400">
                    {addresses.length} address{addresses.length === 1 ? "" : "es"} saved
                </p>
                <button
                    type="button"
                    onClick={() => setMode({ kind: "new" })}
                    className="inline-flex items-center gap-2 rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400"
                >
                    <Plus className="h-4 w-4" />
                    Add address
                </button>
            </div>

            {addresses.length === 0 ? (
                <div className="rounded-md border border-slate-700 bg-slate-800 p-8 text-center text-sm text-slate-400">
                    No addresses saved yet. Add one to use at checkout.
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {addresses.map((addr) => (
                        <div
                            key={addr.id}
                            className="rounded-md border border-slate-700 bg-slate-800 p-4"
                        >
                            <div className="text-sm text-slate-200">
                                <p className="font-medium text-white">{addr.name}</p>
                                <p className="text-slate-400">{addr.phone}</p>
                                <p>{addr.line1}</p>
                                {addr.line2 && <p>{addr.line2}</p>}
                                <p>
                                    {addr.city}
                                    {addr.state ? `, ${addr.state}` : ""} {addr.postalCode}
                                </p>
                                {addr.country && <p>{addr.country}</p>}
                            </div>
                            <div className="mt-4 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setMode({ kind: "edit", id: addr.id })
                                    }
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDelete(addr.id)}
                                    className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function AddressForm({
    initial,
    onSubmit,
    onCancel,
}: {
    initial?: AddressDTO;
    onSubmit: (a: AddressInput) => Promise<string | null>;
    onCancel: () => void;
}) {
    const [name, setName] = useState(initial?.name ?? "");
    const [phone, setPhone] = useState(initial?.phone ?? "");
    const [line1, setLine1] = useState(initial?.line1 ?? "");
    const [line2, setLine2] = useState(initial?.line2 ?? "");
    const [city, setCity] = useState(initial?.city ?? "");
    const [state, setState] = useState(initial?.state ?? "");
    const [postalCode, setPostalCode] = useState(initial?.postalCode ?? "");
    const [country, setCountry] = useState(initial?.country ?? "");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.SyntheticEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);
        const payload: AddressInput = {
            name: name.trim(),
            phone: phone.trim(),
            line1: line1.trim(),
            line2: line2.trim() ? line2.trim() : null,
            city: city.trim(),
            state: state.trim() ? state.trim() : null,
            postalCode: postalCode.trim(),
            country: country.trim() ? country.trim() : null,
        };
        const err = await onSubmit(payload);
        if (err) setError(err);
        setLoading(false);
    }

    return (
        <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                    {initial ? "Edit address" : "New address"}
                </h2>
                <button
                    type="button"
                    onClick={onCancel}
                    className="text-slate-400 hover:text-white"
                    aria-label="Close"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            <ErrorBanner message={error} />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Recipient name" required value={name} onChange={setName} />
                <Field label="Phone" required value={phone} onChange={setPhone} />
            </div>
            <Field label="Address line 1" required value={line1} onChange={setLine1} />
            <Field label="Address line 2" value={line2 ?? ""} onChange={setLine2} />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="City" required value={city} onChange={setCity} />
                <Field label="State / Region" value={state ?? ""} onChange={setState} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                    label="Postal code"
                    required
                    value={postalCode}
                    onChange={setPostalCode}
                />
                <Field label="Country" value={country ?? ""} onChange={setCountry} />
            </div>

            <div className="flex gap-3 pt-2">
                <button
                    type="submit"
                    disabled={loading}
                    className="rounded bg-sky-500 px-4 py-2 font-medium text-white hover:bg-sky-400 disabled:opacity-60"
                >
                    {loading ? "Saving..." : initial ? "Save changes" : "Add address"}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded border border-slate-700 px-4 py-2 font-medium text-slate-200 hover:bg-slate-800"
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}

function Field({
    label,
    required,
    value,
    onChange,
}: {
    label: string;
    required?: boolean;
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div>
            <label className="mb-1 block text-sm font-medium text-slate-200">
                {label}
                {required && <span className="text-red-400"> *</span>}
            </label>
            <input
                type="text"
                required={required}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
        </div>
    );
}
