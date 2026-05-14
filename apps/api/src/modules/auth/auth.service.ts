import { prisma } from "@repo/db";
import type {
    AddressInput,
    ChangePasswordInput,
    SigninInput,
    SignupInput,
    UpdateProfileInput,
    AddressDTO,
} from "@repo/shared";
import { ErrorCode } from "@repo/shared";
import { AppError } from "../../lib/errors";
import { hashPassword, verifyPassword } from "../../lib/password";
import { signToken } from "../../lib/jwt";

const toPublicUser = (u: {
    id: string;
    email: string;
    name: string | null;
    role: "CUSTOMER" | "ADMIN";
    tokenVersion: number;
}) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
});

export const authService = {
    async signup(input: SignupInput) {
        const existing = await prisma.user.findUnique({
            where: { email: input.email },
            select: { id: true },
        });
        if (existing) {
            throw new AppError(409, ErrorCode.EMAIL_IN_USE, "Email already in use");
        }
        const passwordHash = await hashPassword(input.password);
        const user = await prisma.user.create({
            data: {
                email: input.email,
                passwordHash,
                name: input.name,
            },
            select: { id: true, email: true, name: true, role: true, tokenVersion: true },
        });
        const token = signToken({ sub: user.id, role: user.role, tv: user.tokenVersion });
        return { user: toPublicUser(user), token };
    },

    async signin(input: SigninInput) {
        const user = await prisma.user.findUnique({
            where: { email: input.email },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                passwordHash: true,
                tokenVersion: true,
            },
        });
        if (!user) {
            throw new AppError(401, ErrorCode.INVALID_CREDENTIALS, "Invalid email or password");
        }
        const ok = await verifyPassword(user.passwordHash, input.password);
        if (!ok) {
            throw new AppError(401, ErrorCode.INVALID_CREDENTIALS, "Invalid email or password");
        }
        const token = signToken({ sub: user.id, role: user.role, tv: user.tokenVersion });
        return { user: toPublicUser(user), token };
    },

    async me(userId: string) {
        const user = await prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: { id: true, email: true, name: true, role: true, tokenVersion: true },
        });
        return toPublicUser(user);
    },

    async changePassword(userId: string, input: ChangePasswordInput) {
        const user = await prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: { id: true, passwordHash: true, tokenVersion: true, role: true },
        });
        const ok = await verifyPassword(user.passwordHash, input.currentPassword);
        if (!ok) {
            throw new AppError(
                401,
                ErrorCode.INVALID_CREDENTIALS,
                "Current password is incorrect",
            );
        }
        const passwordHash = await hashPassword(input.newPassword);
        const updated = await prisma.$transaction(async (tx) => {
            return tx.user.update({
                where: { id: userId },
                data: { passwordHash, tokenVersion: { increment: 1 } },
                select: { id: true, email: true, name: true, role: true, tokenVersion: true },
            });
        });
        const token = signToken({ sub: updated.id, role: updated.role, tv: updated.tokenVersion });
        return { user: toPublicUser(updated), token };
    },

    async updateProfile(userId: string, input: UpdateProfileInput) {
        const user = await prisma.user.update({
            where: { id: userId },
            data: { name: input.name ?? null },
            select: { id: true, email: true, name: true, role: true, tokenVersion: true },
        });
        return toPublicUser(user);
    },

    async signOutAll(userId: string): Promise<void> {
        await prisma.user.update({
            where: { id: userId },
            data: { tokenVersion: { increment: 1 } },
        });
    },

    async listAddresses(userId: string): Promise<AddressDTO[]> {
        const rows = await prisma.address.findMany({
            where: { userId },
            orderBy: { createdAt: "asc" },
        });
        return rows.map(toAddressDTO);
    },

    async createAddress(userId: string, input: AddressInput): Promise<AddressDTO> {
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

    async updateAddress(
        userId: string,
        addressId: string,
        input: AddressInput,
    ): Promise<AddressDTO> {
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

    async deleteAddress(userId: string, addressId: string): Promise<void> {
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
