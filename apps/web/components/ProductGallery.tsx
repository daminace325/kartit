"use client";

import { useState } from "react";
import { productImageUrl } from "@/lib/image";
import type { ProductImageDTO } from "@repo/shared";

export default function ProductGallery({
    images,
    title,
}: {
    images: ProductImageDTO[];
    title: string;
}) {
    const [active, setActive] = useState(0);

    if (images.length === 0) {
        return (
            <div className="flex aspect-square w-full items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-sm text-slate-400">
                No image
            </div>
        );
    }

    const main = productImageUrl(images[active], "detailMain");

    return (
        <div className="space-y-3">
            <div className="aspect-square w-full overflow-hidden rounded-md border border-slate-700 bg-slate-800">
                {main && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={main}
                        alt={images[active].alt ?? title}
                        className="h-full w-full object-cover"
                    />
                )}
            </div>

            {images.length > 1 && (
                <div className="flex flex-wrap gap-2">
                    {images.map((img, idx) => {
                        const thumb = productImageUrl(img, "thumb");
                        return (
                            <button
                                key={img.id}
                                type="button"
                                onClick={() => setActive(idx)}
                                className={
                                    idx === active
                                        ? "h-16 w-16 overflow-hidden rounded border-2 border-sky-500"
                                        : "h-16 w-16 overflow-hidden rounded border border-slate-700 opacity-70 transition hover:opacity-100"
                                }
                            >
                                {thumb && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={thumb}
                                        alt={img.alt ?? `${title} thumbnail ${idx + 1}`}
                                        className="h-full w-full object-cover"
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
