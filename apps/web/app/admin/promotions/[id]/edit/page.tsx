import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api, ApiClientError } from "@/services/apiClient";
import type { PromotionDTO } from "@repo/shared";
import PromotionForm from "../../PromotionForm";

export const dynamic = "force-dynamic";

export default async function EditPromotionPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    let promotion: PromotionDTO;
    try {
        ({ promotion } = await api.get<{ promotion: PromotionDTO }>(
            `/promotions/${encodeURIComponent(id)}`,
        ));
    } catch (err) {
        if (err instanceof ApiClientError && err.status === 404) notFound();
        throw err;
    }

    return (
        <div className="px-8 py-8">
            <Link
                href="/admin/promotions"
                className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to promotions
            </Link>
            <h1 className="mb-6 text-3xl font-semibold text-white">
                Edit promotion{" "}
                <code className="rounded bg-slate-800 px-2 py-0.5 text-lg text-slate-300">
                    {promotion.code}
                </code>
            </h1>
            <PromotionForm mode="edit" initial={promotion} />
        </div>
    );
}
