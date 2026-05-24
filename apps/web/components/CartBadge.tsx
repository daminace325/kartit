import Link from "next/link";
import { ShoppingCart } from "lucide-react";

export default function CartBadge({ count }: { count: number }) {
    return (
        <Link
            href="/cart"
            aria-label="Cart"
            className="relative shrink-0 rounded-md p-2 hover:bg-slate-800"
        >
            <ShoppingCart className="h-6 w-6" />
            {count > 0 && (
                <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-sky-500 px-1.5 text-center text-xs font-bold text-white">
                    {count}
                </span>
            )}
        </Link>
    );
}
