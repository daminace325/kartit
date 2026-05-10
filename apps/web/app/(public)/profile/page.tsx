import { getCurrentUser } from "@/lib/auth";
import EditProfileForm from "@/components/EditProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
    const user = (await getCurrentUser())!;

    return (
        <div>
            <h1 className="mb-6 text-2xl font-semibold text-white">Edit Profile</h1>
            <EditProfileForm initialName={user.name ?? ""} email={user.email} />
        </div>
    );
}
