import { prisma } from "@repo/db";
import type {
    ChangePasswordInput,
    SigninInput,
    SignupInput,
    UpdateProfileInput,
} from "@repo/shared";
import { ErrorCode } from "@repo/shared";
import { AppError } from "../../lib/errors";
import { hashPassword, verifyPassword } from "../../lib/password";
import { signToken } from "../../lib/jwt";
import { userCache } from "../../lib/cache";

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
        userCache.del(userId);
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
        userCache.del(userId);
    },
};