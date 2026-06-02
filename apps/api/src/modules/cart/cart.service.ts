import { prisma } from "@repo/db";
import type { Prisma } from "@repo/db";
import {
    calculatePricing,
    type CartDTO,
    type CartItemDTO,
    type CartSummaryDTO,
} from "@repo/shared";
import { AppError } from "../../lib/errors";
import { promotionsService } from "../promotions/promotions.service";

type CartWithItems = Prisma.CartGetPayload<{
    include: {
        items: {
            include: {
                product: {
                    include: {
                        images: true;
                        category: { select: { isActive: true } };
                    };
                };
            };
        };
    };
}>;

const CART_INCLUDE = {
    items: {
        include: {
            product: {
                include: {
                    images: true,
                    category: { select: { isActive: true } },
                },
            },
        },
        orderBy: { createdAt: "asc" as const },
    },
} satisfies Prisma.CartInclude;

function availableStock(product: { physicalStock: number; reservedQty: number }): number {
    return product.physicalStock - product.reservedQty;
}

function toItemDTO(item: CartWithItems["items"][number]): CartItemDTO {
    const product = item.product;
    const cover = [...product.images].sort((a, b) => a.position - b.position)[0];
    const lineTotal = product.priceMinor * BigInt(item.quantity);
    return {
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        productSlug: product.slug,
        productName: product.name,
        unitPriceMinor: product.priceMinor.toString(),
        currency: product.currency,
        imageUrl: cover?.url ?? null,
        stock: availableStock(product),
        isActive: product.isActive && product.category.isActive,
        lineTotalMinor: lineTotal.toString(),
    };
}

function toCartDTO(cart: CartWithItems): CartDTO {
    const items = cart.items.map(toItemDTO);
    const currency = items[0]?.currency ?? "USD";
    const subtotal = cart.items.reduce(
        (acc, it) => acc + it.product.priceMinor * BigInt(it.quantity),
        0n,
    );
    const itemCount = items.reduce((acc, it) => acc + it.quantity, 0);
    return {
        id: cart.id,
        items,
        currency,
        subtotalMinor: subtotal.toString(),
        itemCount,
    };
}

async function getOrCreateCart(userId: string): Promise<CartWithItems> {
    return prisma.cart.upsert({
        where: { userId },
        create: { userId },
        update: {},
        include: CART_INCLUDE,
    });
}

export const cartService = {
    async get(userId: string): Promise<CartDTO> {
        const cart = await getOrCreateCart(userId);
        return toCartDTO(cart);
    },

    async addItem(
        userId: string,
        productId: string,
        quantity: number,
    ): Promise<CartDTO> {
        const product = await prisma.product.findUnique({
            where: { id: productId, deletedAt: null },
            select: { id: true, isActive: true, physicalStock: true, reservedQty: true, category: { select: { isActive: true } } },
        });
        if (!product) throw AppError.notFound("NOT_FOUND", "Product not found");
        if (!product.isActive || !product.category.isActive) {
            throw AppError.badRequest("PRODUCT_INACTIVE", "Product is not available");
        }

        const cart = await getOrCreateCart(userId);
        const avail = availableStock(product);

        // Atomic increment avoids the TOCTOU window where two concurrent
        // requests both read the old quantity, add their delta, and write
        // back — only one wins with increment.
        const item = await prisma.cartItem.upsert({
            where: { cartId_productId: { cartId: cart.id, productId } },
            create: { cartId: cart.id, productId, quantity },
            update: { quantity: { increment: quantity } },
        });

        // Guarded clamp: only updates if quantity still exceeds available stock
        // (another request may have removed items in between, making this a no-op).
        if (item.quantity > avail) {
            const clamped = await prisma.cartItem.updateMany({
                where: { id: item.id, quantity: { gt: avail } },
                data: { quantity: avail },
            });
            if (clamped.count > 0) {
                throw AppError.conflict(
                    "INSUFFICIENT_STOCK",
                    `Only ${avail} in stock`,
                );
            }
        }

        const updated = await prisma.cart.findUnique({
            where: { id: cart.id },
            include: CART_INCLUDE,
        });
        return toCartDTO(updated!);
    },

    async updateItem(
        userId: string,
        productId: string,
        quantity: number,
    ): Promise<CartDTO> {
        const cart = await getOrCreateCart(userId);
        const existing = cart.items.find((it) => it.productId === productId);
        if (!existing) {
            throw AppError.notFound("NOT_FOUND", "Item not in cart");
        }

        if (quantity === 0) {
            await prisma.cartItem.delete({ where: { id: existing.id } });
        } else {
            const product = await prisma.product.findUnique({
                where: { id: productId, deletedAt: null },
                select: { physicalStock: true, reservedQty: true, isActive: true, category: { select: { isActive: true } } },
            });
            if (!product || !product.isActive || !product.category.isActive) {
                throw AppError.badRequest("PRODUCT_INACTIVE", "Product is not available");
            }
            const avail = availableStock(product);
            if (quantity > avail) {
                throw AppError.conflict(
                    "INSUFFICIENT_STOCK",
                    `Only ${avail} in stock`,
                );
            }
            await prisma.cartItem.update({
                where: { id: existing.id },
                data: { quantity },
            });
        }

        const updated = await prisma.cart.findUnique({
            where: { id: cart.id },
            include: CART_INCLUDE,
        });
        return toCartDTO(updated!);
    },

    async removeItem(userId: string, productId: string): Promise<CartDTO> {
        const cart = await getOrCreateCart(userId);
        const existing = cart.items.find((it) => it.productId === productId);
        if (!existing) {
            throw AppError.notFound("NOT_FOUND", "Item not in cart");
        }
        await prisma.cartItem.delete({ where: { id: existing.id } });

        const updated = await prisma.cart.findUnique({
            where: { id: cart.id },
            include: CART_INCLUDE,
        });
        return toCartDTO(updated!);
    },

    async clear(userId: string): Promise<CartDTO> {
        const cart = await getOrCreateCart(userId);
        await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
        const updated = await prisma.cart.findUnique({
            where: { id: cart.id },
            include: CART_INCLUDE,
        });
        return toCartDTO(updated!);
    },

    async summary(userId: string, promotionCode?: string): Promise<CartSummaryDTO> {
        const cart = await getOrCreateCart(userId);
        if (cart.items.length === 0) {
            throw AppError.badRequest("CART_EMPTY", "Cart is empty");
        }

        // Stock revalidation (in case stock dropped after items were added).
        for (const item of cart.items) {
            if (!item.product.isActive || !item.product.category.isActive || item.product.deletedAt) {
                throw AppError.conflict(
                    "PRODUCT_INACTIVE",
                    `Product "${item.product.name}" is no longer available`,
                );
            }
            const avail = availableStock(item.product);
            if (item.quantity > avail) {
                throw AppError.conflict(
                    "INSUFFICIENT_STOCK",
                    `Only ${avail} of "${item.product.name}" in stock`,
                );
            }
        }

        const items = cart.items.map(toItemDTO);
        const currency = items[0]?.currency ?? "USD";
        const subtotal = cart.items.reduce(
            (acc, it) => acc + it.product.priceMinor * BigInt(it.quantity),
            0n,
        );

        let discountMinor = 0n;
        let validPromotion: { id: string; code: string; discountMinor: bigint } | null = null;

        if (promotionCode) {
            validPromotion = await promotionsService.validate(promotionCode, subtotal, userId);
            if (!validPromotion) {
                throw AppError.badRequest("PROMOTION_INVALID", "Invalid or expired promotion code");
            }
            discountMinor = validPromotion.discountMinor;
        }

        const pricing = calculatePricing({ subtotal, currency, discountMinor });

        return {
            cartId: cart.id,
            items,
            currency: pricing.currency,
            subtotalMinor: pricing.subtotal.toString(),
            discountMinor: pricing.discount.toString(),
            shippingMinor: pricing.shipping.toString(),
            taxMinor: pricing.tax.toString(),
            totalMinor: pricing.total.toString(),
            shippingNote: pricing.shippingNote,
            taxNote: pricing.taxNote,
            discountNote: pricing.discountNote,
            promotionCode: validPromotion?.code,
        };
    },
};
