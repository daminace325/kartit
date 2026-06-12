"use client";

import Link from "next/link";
import { useEffect } from "react";

type Props = {
    error: Error & { digest?: string };
    reset: () => void;
    title: string;
    /** Default: error?.message ?? "Something went wrong." */
    message?: string;
    /** Show the error.digest ID. Default: false. */
    showDigest?: boolean;
    /** If provided, renders a secondary "home" link. */
    homeHref?: string;
    homeLabel?: string;
    /** Override reset button color. Default: "bg-red-500 hover:bg-red-400" */
    buttonColor?: string;
    /** Override title classes. Default: "text-lg font-semibold text-red-100" */
    titleClassName?: string;
    /** Override message classes. Default: "mt-2 text-sm text-red-200/80" */
    messageClassName?: string;
};

export default function ErrorPage({
    error,
    reset,
    title,
    message,
    showDigest = false,
    homeHref,
    homeLabel = "Go home",
    buttonColor = "bg-red-500 hover:bg-red-400",
    titleClassName = "text-lg font-semibold text-red-100",
    messageClassName = "mt-2 text-sm text-red-200/80",
}: Props) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <>
            <h2 className={titleClassName}>{title}</h2>
            <p className={messageClassName}>
                {message ?? error?.message ?? "Something went wrong."}
            </p>
            {showDigest && error?.digest && (
                <p className="mt-1 text-xs text-red-200/60">
                    Error ID: {error.digest}
                </p>
            )}
            <div className="mt-5 flex justify-center gap-3">
                <button
                    type="button"
                    onClick={reset}
                    className={`rounded-md px-4 py-2 text-sm font-medium text-white ${buttonColor}`}
                >
                    Try again
                </button>
                {homeHref && (
                    <Link
                        href={homeHref}
                        className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500"
                    >
                        {homeLabel}
                    </Link>
                )}
            </div>
        </>
    );
}
