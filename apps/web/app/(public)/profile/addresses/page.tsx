import type { AddressDTO } from "@repo/shared";
import { api } from "@/lib/api";
import AddressesManager from "@/components/AddressesManager";

export const dynamic = "force-dynamic";

export default async function AddressesPage() {
    const { addresses } = await api.get<{ addresses: AddressDTO[] }>(
        "/auth/me/addresses",
    );

    return (
        <div>
            <h1 className="mb-6 text-2xl font-semibold text-white">Your Addresses</h1>
            <AddressesManager initialAddresses={addresses} />
        </div>
    );
}
