import { getCurrentUser } from "@/lib/auth";
import ChangePasswordForm from "@/components/ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
    const user = (await getCurrentUser())!;

    return (
        <div>
            <h1 className="text-2xl font-semibold text-white">Login &amp; Security</h1>
            <p className="mt-1 text-sm text-slate-400">
                Update the password on <span className="text-slate-200">{user.email}</span>.
            </p>

            <div className="mt-6 rounded-md border border-slate-700 bg-slate-800 p-6">
                <ChangePasswordForm />
            </div>
        </div>
    );
}
