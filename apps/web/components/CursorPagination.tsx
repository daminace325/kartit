import Link from "next/link";

type Props = {
    /** Falsy = nothing rendered. */
    nextCursor: string | null;
    /** Full href including the encoded cursor query param and any page-specific filters. */
    href: string;
    /** Override the wrapper margin. Default: "mt-6". */
    className?: string;
};

export default function CursorPagination({ nextCursor, href, className }: Props) {
    if (!nextCursor) return null;

    return (
        <div className={`flex justify-center ${className ?? "mt-6"}`}>
            <Link
                href={href}
                className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"
            >
                Load more →
            </Link>
        </div>
    );
}
