import { z } from "zod";

export const signupSchema = z.object({
    email: z.email(),
    password: z.string().min(8).max(100),
    name: z.string().min(1).max(80).optional(),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const signinSchema = z.object({
    email: z.email(),
    password: z.string().min(1),
});
export type SigninInput = z.infer<typeof signinSchema>;

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(100),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateProfileSchema = z.object({
    name: z.string().min(1).max(80).nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const addressInputSchema = z.object({
    line1: z.string().min(1).max(120),
    line2: z.string().max(120).optional().nullable(),
    city: z.string().min(1).max(80),
    state: z.string().max(80).optional().nullable(),
    postalCode: z.string().min(1).max(20),
    country: z.string().max(80).optional().nullable(),
});
export type AddressInput = z.infer<typeof addressInputSchema>;

export type AddressDTO = {
    id: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    postalCode: string;
    country: string | null;
    createdAt: string;
    updatedAt: string;
};
