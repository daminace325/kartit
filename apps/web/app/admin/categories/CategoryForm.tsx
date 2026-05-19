"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { slugify } from "@/lib/strings";
import { formatApiError } from "@/lib/errors";
import { csrfFetch } from "@/lib/csrf";
import { ErrorBanner } from "@/components/ErrorBanner";

type Initial = { id: string; name: string; slug: string; parentId: string | null };

type ParentOption = { id: string; name: string };

type Props = {
    mode: "create" | "edit";
    initial?: Initial;
    parentOptions: ParentOption[];
};

export default function CategoryForm({ mode, initial, parentOptions }: Props) {
    const router = useRouter();
    const [name, setName] = useState(initial?.name ?? "");
    const [slug, setSlug] = useState(initial?.slug ?? "");
    const [parentId, setParentId] = useState<string>(initial?.parentId ?? "");
    const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    function onNameChange(value: string) {
        setName(value);
        if (!slugTouched) setSlug(slugify(value));
    }

    async function handleSubmit(e: React.SyntheticEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const payload: Record<string, unknown> = {
            name: name.trim(),
            slug: slug.trim(),
            // Always send parentId — null clears it on edit, omit-equivalent on create.
            parentId: parentId ? parentId : null,
        };

        try {
            const url =
                mode === "create"
                    ? "/api/categories"
                    : `/api/categories/${initial!.id}`;
            const method = mode === "create" ? "POST" : "PUT";

            const res = await csrfFetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(formatApiError(data?.error, "Failed to save category"));
                return;
            }

            router.push("/admin/categories");
            router.refresh();
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
            <ErrorBanner message={error} />

            <div>
                <label className="mb-1 block text-sm font-medium text-slate-200">Name</label>
                <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => onNameChange(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
            </div>

            <div>
                <label className="mb-1 block text-sm font-medium text-slate-200">Slug</label>
                <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => {
                        setSlug(e.target.value);
                        setSlugTouched(true);
                    }}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
                <p className="mt-1 text-xs text-slate-400">
                    URL-friendly identifier. Used at /c/&lt;slug&gt;.
                </p>
            </div>

            <div>
                <label className="mb-1 block text-sm font-medium text-slate-200">
                    Parent category
                </label>
                <select
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                >
                    <option value="">— None (top level) —</option>
                    {parentOptions
                        .filter((c) => c.id !== initial?.id)
                        .map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                </select>
                <p className="mt-1 text-xs text-slate-400">
                    Nesting is limited to 2 levels. Only top-level categories can be parents.
                </p>
            </div>

            <div className="flex gap-3 pt-2">
                <button
                    type="submit"
                    disabled={loading}
                    className="rounded bg-sky-500 px-4 py-2 font-medium text-white hover:bg-sky-400 disabled:opacity-60"
                >
                    {loading
                        ? "Saving..."
                        : mode === "create"
                          ? "Create category"
                          : "Save changes"}
                </button>
                <button
                    type="button"
                    onClick={() => router.push("/admin/categories")}
                    className="rounded border border-slate-700 px-4 py-2 font-medium text-slate-200 hover:bg-slate-800"
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}
