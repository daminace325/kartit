import crypto from "node:crypto";
import type { Prisma } from "@repo/db";
import {
    OrderStatus,
    VALID_STATUS_TRANSITIONS,
    type OrderDTO,
    type OrderItemDTO,
} from "@repo/shared";

// ── Types ─────────────────────────────────────────────────────────

type OrderWithItems = Prisma.OrderGetPayload<{
    include: { items: true };
}>;

// ── Prisma include ────────────────────────────────────────────────

export const ORDER_INCLUDE = {
    items: { orderBy: { id: "asc" as const } },
} satisfies Prisma.OrderInclude;

// ── Order number generation ───────────────────────────────────────

export function generateOrderNumber(): string {
    const today = new Date();
    const y = today.getFullYear().toString();
    const m = (today.getMonth() + 1).toString().padStart(2, "0");
    const d = today.getDate().toString().padStart(2, "0");
    const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
    return `ECM-${y}${m}${d}-${suffix}`;
}

// ── DTO mapping ───────────────────────────────────────────────────

function toItemDTO(item: OrderWithItems["items"][number]): OrderItemDTO {
    return {
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        productSlug: item.productSlug,
        imageUrl: item.imageUrl,
        unitPriceMinor: item.unitPriceMinor.toString(),
        currency: item.currency,
        quantity: item.quantity,
        totalMinor: item.totalMinor.toString(),
    };
}

export function toOrderDTO(order: OrderWithItems): OrderDTO {
    return {
        id: order.id,
        orderNumber: order.orderNumber,
        userId: order.userId,
        status: order.status as OrderStatus,
        subtotalMinor: order.subtotalMinor.toString(),
        shippingMinor: order.shippingMinor.toString(),
        taxMinor: order.taxMinor.toString(),
        discountMinor: order.discountMinor.toString(),
        totalMinor: order.totalMinor.toString(),
        currency: order.currency,
        promotionCode: order.promotionCode,
        shippingName: order.shippingName,
        shippingPhone: order.shippingPhone,
        shippingLine1: order.shippingLine1,
        shippingLine2: order.shippingLine2,
        shippingCity: order.shippingCity,
        shippingState: order.shippingState,
        shippingPostalCode: order.shippingPostalCode,
        shippingCountry: order.shippingCountry,
        items: order.items.map(toItemDTO),
        paidAt: order.paidAt ? order.paidAt.toISOString() : null,
        deliveredAt: order.deliveredAt ? order.deliveredAt.toISOString() : null,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
    };
}

// ── Admin status transitions ──────────────────────────────────────

/**
 * Allowed admin-driven status transitions. Customer-initiated cancel uses
 * the dedicated cancel route and is restricted to PENDING in Phase 1.
 * Sourced from @repo/shared so the client and server share one definition.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, ReadonlySet<OrderStatus>> =
    Object.fromEntries(
        Object.entries(VALID_STATUS_TRANSITIONS).map(([key, values]) => [
            key,
            new Set(values),
        ]),
    ) as unknown as Record<OrderStatus, ReadonlySet<OrderStatus>>;
