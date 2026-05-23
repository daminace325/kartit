import { prisma } from "@repo/db";
import type { AddressInput, AddressDTO } from "@repo/shared";
import { AppError } from "../../lib/errors";

const toAddressDTO = (a: {
    id: string;
    name: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    postalCode: string;
    country: string | null;
    createdAt: Date;
    updatedAt: Date;
}): AddressDTO => ({
    id: a.id,
    name: a.name,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    state: a.state,
    postalCode: a.postalCode,
    country: a.country,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
});

export const addressesService = {
    async list(userId: string): Promise<AddressDTO[]> {
        const rows = await prisma.address.findMany({
            where: { userId },
            orderBy: { createdAt: "asc" },
        });
        return rows.map(toAddressDTO);
    },

    async create(userId: string, input: AddressInput): Promise<AddressDTO> {
        const row = await prisma.address.create({
            data: {
                userId,
                name: input.name,
                phone: input.phone,
                line1: input.line1,
                line2: input.line2 ?? null,
                city: input.city,
                state: input.state ?? null,
                postalCode: input.postalCode,
                country: input.country ?? null,
            },
        });
        return toAddressDTO(row);
    },

    async update(userId: string, addressId: string, input: AddressInput): Promise<AddressDTO> {
        const existing = await prisma.address.findUnique({
            where: { id: addressId },
            select: { userId: true },
        });
        if (!existing || existing.userId !== userId) {
            throw AppError.notFound("ADDRESS_NOT_FOUND", "Address not found");
        }
        const row = await prisma.address.update({
            where: { id: addressId },
            data: {
                name: input.name,
                phone: input.phone,
                line1: input.line1,
                line2: input.line2 ?? null,
                city: input.city,
                state: input.state ?? null,
                postalCode: input.postalCode,
                country: input.country ?? null,
            },
        });
        return toAddressDTO(row);
    },

    async delete(userId: string, addressId: string): Promise<void> {
        const existing = await prisma.address.findUnique({
            where: { id: addressId },
            select: { userId: true },
        });
        if (!existing || existing.userId !== userId) {
            throw AppError.notFound("ADDRESS_NOT_FOUND", "Address not found");
        }
        await prisma.address.delete({ where: { id: addressId } });
    },
};
