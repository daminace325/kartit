"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { minorToMajor, majorToMinor, type ProductDTO, type ProductImageDTO } from "@repo/shared";
import { slugify } from "@/lib/slugify";
import { formatApiError } from "@/lib/formatApiError";
import { csrfFetch } from "@/lib/csrf";
import { useApiMutation } from "@/hooks/useApiMutation";
import { ErrorBanner } from "@/components/ErrorBanner";

type CategoryOption = { id: string; name: string };

type UploadedImage = {
    url: string;
    publicId: string;
    alt?: string | null;
};

type Props = {
    mode: "create" | "edit";
    initial?: Pick<
        ProductDTO,
        | "id"
        | "slug"
        | "name"
        | "description"
        | "priceMinor"
        | "currency"
        | "stock"
        | "isActive"
        | "categoryId"
        | "images"
    >;
    categoryOptions: CategoryOption[];
};

export default function ProductForm({ mode, initial, categoryOptions }: Props) {
    const router = useRouter();

    // Currency assumed 2 decimals for the form. (USD/INR/EUR all 2.)
    const initialCurrency = initial?.currency ?? "USD";

    const [name, setName] = useState(initial?.name ?? "");
    const [slug, setSlug] = useState(initial?.slug ?? "");
    const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
    const [description, setDescription] = useState(initial?.description ?? "");
    const [price, setPrice] = useState<string>(
        initial?.priceMinor !== undefined ? minorToMajor(initial.priceMinor, 2) : "",
    );
    const [currency, setCurrency] = useState(initialCurrency);
    const [stock, setStock] = useState<string>(
        initial?.stock !== undefined ? String(initial.stock) : "0",
    );
    const [categoryId, setCategoryId] = useState<string>(
        initial?.categoryId ?? categoryOptions[0]?.id ?? "",
    );
    const [isActive, setIsActive] = useState<boolean>(initial?.isActive ?? true);
    const [images, setImages] = useState<UploadedImage[]>(
        (initial?.images ?? []).map((i: ProductImageDTO) => ({
            url: i.url,
            publicId: i.publicId,
            alt: i.alt,
        })),
    );

    const [uploading, setUploading] = useState(false);
    const { execute, loading, error, setError, clearError } = useApiMutation();

    function onNameChange(value: string) {
        setName(value);
        if (!slugTouched) setSlug(slugify(value));
    }

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploading(true);
        setError(null);

        try {
            for (const file of Array.from(files)) {
                if (images.length >= 6) {
                    setError("Maximum 6 images per product");
                    break;
                }
                const formData = new FormData();
                formData.append("file", file);
                const res = await csrfFetch("/api/images/upload", {
                    method: "POST",
                    body: formData,
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    setError(formatApiError(data?.error, "Upload failed"));
                    break;
                }
                setImages((prev) => [
                    ...prev,
                    { url: data.url, publicId: data.publicId },
                ]);
            }
        } catch {
            setError("Network error during upload");
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    }

    async function removeImage(idx: number) {
        const img = images[idx];
        setImages((prev) => prev.filter((_, i) => i !== idx));
        // Best-effort cleanup of the orphaned Cloudinary asset (ignore errors).
        if (img?.publicId) {
            csrfFetch("/api/images", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ publicId: img.publicId }),
            }).catch(() => undefined);
        }
    }

    async function handleSubmit(e: React.SyntheticEvent) {
        e.preventDefault();

        let priceMinor: string;
        try {
            priceMinor = majorToMinor(price, 2);
        } catch {
            setError("Price must be a valid number (e.g. 19.99)");
            return;
        }
        const stockNum = Number(stock);
        if (!Number.isInteger(stockNum) || stockNum < 0) {
            setError("Stock must be a non-negative integer");
            return;
        }
        if (!categoryId) {
            setError("Pick a category");
            return;
        }

        const url =
            mode === "create" ? "/api/products" : `/api/products/${initial!.id}`;
        const method = mode === "create" ? "POST" : "PUT";

        const result = await execute(
            url,
            {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    slug: slug.trim(),
                    description: description.trim(),
                    priceMinor: Number(priceMinor),
                    currency: currency.trim().toUpperCase(),
                    stock: stockNum,
                    isActive,
                    categoryId,
                    images: images.map((i) => ({
                        url: i.url,
                        publicId: i.publicId,
                        ...(i.alt ? { alt: i.alt } : {}),
                    })),
                }),
            },
            "Failed to save product",
        );
        if (!result.ok) return;

        router.push("/admin/products");
        router.refresh();
    }

    return (
        <form onSubmit={handleSubmit} className="max-w-3xl space-y-5">
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
                    URL-friendly identifier. Used at /p/&lt;slug&gt;.
                </p>
            </div>

            <div>
                <label className="mb-1 block text-sm font-medium text-slate-200">
                    Description
                </label>
                <textarea
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-200">
                        Price
                    </label>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-200">
                        Currency
                    </label>
                    <input
                        type="text"
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                        maxLength={3}
                        className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-sm font-medium text-slate-200">
                        Stock
                    </label>
                    <input
                        type="number"
                        min="0"
                        step="1"
                        required
                        value={stock}
                        onChange={(e) => setStock(e.target.value)}
                        className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    />
                </div>
            </div>

            <div>
                <label className="mb-1 block text-sm font-medium text-slate-200">
                    Category
                </label>
                {categoryOptions.length === 0 ? (
                    <p className="text-sm text-slate-400">
                        No categories yet. Create one first.
                    </p>
                ) : (
                    <select
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    >
                        {categoryOptions.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 accent-sky-500"
                />
                Active (visible in storefront)
            </label>

            <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                    Images <span className="text-xs text-slate-500">(up to 6)</span>
                </label>

                {images.length > 0 && (
                    <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {images.map((img, idx) => (
                            <div
                                key={img.publicId}
                                className="group relative aspect-square overflow-hidden rounded border border-slate-700 bg-slate-900"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={img.url}
                                    alt=""
                                    className="h-full w-full object-cover"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeImage(idx)}
                                    className="absolute right-1 top-1 rounded-full bg-slate-900/80 p-1 text-red-300 opacity-0 transition group-hover:opacity-100 hover:bg-red-500 hover:text-white"
                                    aria-label="Remove image"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
                    {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Upload className="h-4 w-4" />
                    )}
                    {uploading ? "Uploading..." : "Upload images"}
                    <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        multiple
                        disabled={uploading || images.length >= 6}
                        onChange={handleUpload}
                        className="hidden"
                    />
                </label>
                <p className="mt-1 text-xs text-slate-400">
                    JPEG, PNG, WebP, or GIF. Max 5MB each.
                </p>
            </div>

            <div className="flex gap-3 pt-2">
                <button
                    type="submit"
                    disabled={loading || uploading}
                    className="rounded bg-sky-500 px-4 py-2 font-medium text-white hover:bg-sky-400 disabled:opacity-60"
                >
                    {loading
                        ? "Saving..."
                        : mode === "create"
                          ? "Create product"
                          : "Save changes"}
                </button>
                <button
                    type="button"
                    onClick={() => router.push("/admin/products")}
                    className="rounded border border-slate-700 px-4 py-2 font-medium text-slate-200 hover:bg-slate-800"
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}
