import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PromotionForm from "../PromotionForm";

export const dynamic = "force-dynamic";

export default function NewPromotionPage() {
    return (
        <div className="px-8 py-8">
            <Link
                href="/admin/promotions"
                className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to promotions
            </Link>
            <h1 className="mb-6 text-3xl font-semibold text-white">New promotion</h1>
            <PromotionForm mode="create" />
        </div>
    );
}
