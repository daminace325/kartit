import Link from "next/link";
import { formatMoney, type ProductDTO } from "@repo/shared";
import { productImageUrl } from "@/lib/image";

type CardProduct = Pick<
    ProductDTO,
    "slug" | "name" | "priceMinor" | "currency" | "images"
>;

export default function ProductCard({ product }: { product: CardProduct }) {
    const cover = productImageUrl(product.images[0], "card");
    return (
        <Link
            href={`/p/${product.slug}`}
            className="group flex flex-col rounded-md border border-slate-700 bg-slate-800 p-3 transition hover:border-sky-500/50 hover:shadow-md"
        >
            <div className="aspect-square w-full overflow-hidden rounded bg-slate-800">
                {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={cover}
                        alt={product.images[0]?.alt ?? product.name}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                        No image
                    </div>
                )}
            </div>
            <h3 className="mt-2 line-clamp-2 text-sm text-slate-200">{product.name}</h3>
            <p className="mt-auto pt-2 text-base font-semibold text-white">
                {formatMoney(product.priceMinor, product.currency)}
            </p>
        </Link>
    );
}
