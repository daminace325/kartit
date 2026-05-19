import { prisma } from "@repo/db";
import { createApp } from "../src/app";
import supertest from "supertest";
import type { Express } from "express";

export function makeApp(): Express {
    return createApp();
}

export function request(app: Express) {
    return supertest(app);
}

export async function cleanDb() {
    await prisma.webhookEvent.deleteMany();
    await prisma.idempotencyKey.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.productImage.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.address.deleteMany();
    await prisma.user.deleteMany();
}

export async function createTestUser(overrides?: {
    email?: string;
    password?: string;
    name?: string;
}) {
    const { authService } = await import("../src/modules/auth/auth.service");
    const result = await authService.signup({
        email: overrides?.email ?? "test@example.com",
        password: overrides?.password ?? "password123",
        name: overrides?.name ?? "Test User",
    });
    return { user: result.user, token: result.token };
}

export async function createAdminUser() {
    const { authService } = await import("../src/modules/auth/auth.service");
    const result = await authService.signup({
        email: "admin@example.com",
        password: "adminpass123",
        name: "Admin",
    });
    await prisma.user.update({
        where: { id: result.user.id },
        data: { role: "ADMIN" },
    });
    return { user: { ...result.user, role: "ADMIN" as const }, token: result.token };
}

let catCounter = 0;

export async function createTestCategory(slug?: string, name?: string) {
    return prisma.category.create({
        data: {
            slug: slug ?? `test-category-${++catCounter}`,
            name: name ?? "Test Category",
        },
    });
}

let prodCounter = 0;

export async function createTestProduct(overrides?: {
    slug?: string;
    name?: string;
    priceMinor?: bigint;
    stock?: number;
    categoryId?: string;
    isActive?: boolean;
}) {
    const cid =
        overrides?.categoryId ?? (await createTestCategory()).id;
    prodCounter++;

    return prisma.product.create({
        data: {
            slug: overrides?.slug ?? `test-product-${prodCounter}`,
            name: overrides?.name ?? "Test Product",
            description: "A test product",
            priceMinor: overrides?.priceMinor ?? 1999n,
            currency: "USD",
            stock: overrides?.stock ?? 100,
            categoryId: cid,
            isActive: overrides?.isActive ?? true,
        },
    });
}
