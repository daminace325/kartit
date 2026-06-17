import { prisma } from "@repo/db";
import {
    ErrorCode,
    OrderStatus,
    PromotionType,
    type PromotionCreateInput,
    type PromotionUpdateInput,
    type PromotionDTO,
    type PromotionListResponse,
} from "@repo/shared";
import { AppError } from "../../lib/errors";
import { promotionCache } from "../../lib/cache";

const CACHE_TTL = 60 * 1000; // 60 seconds

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDTO(promo: any): PromotionDTO {
    return {
        id: promo.id,
        code: promo.code,
        type: promo.type,
        value: promo.value.toString(),
        minSubtotalMinor: promo.minSubtotalMinor?.toString() ?? null,
        maxUses: promo.maxUses,
        maxUsesPerUser: promo.maxUsesPerUser,
        usedCount: promo._count?.orders ?? 0,
        startsAt: promo.startsAt?.toISOString() ?? null,
        endsAt: promo.endsAt?.toISOString() ?? null,
        isActive: promo.isActive,
        createdAt: promo.createdAt.toISOString(),
        updatedAt: promo.updatedAt.toISOString(),
    };
}

/** Convert a Prisma promotion record to a JSON-serialisable cache entry.
 *  bigint fields become strings; Date fields become ISO strings. */
function toCachedPromotion(record: {
    id: string;
    code: string;
    type: PromotionType;
    value: bigint;
    minSubtotalMinor: bigint | null;
    maxUses: number | null;
    maxUsesPerUser: number | null;
    startsAt: Date | null;
    endsAt: Date | null;
    isActive: boolean;
}) {
    return {
        id: record.id,
        code: record.code,
        type: record.type,
        value: record.value.toString(),
        minSubtotalMinor: record.minSubtotalMinor?.toString() ?? null,
        maxUses: record.maxUses,
        maxUsesPerUser: record.maxUsesPerUser,
        startsAt: record.startsAt?.toISOString() ?? null,
        endsAt: record.endsAt?.toISOString() ?? null,
        isActive: record.isActive,
    };
}

export type ValidatedPromotion = {
    id: string;
    code: string;
    type: PromotionType;
    discountMinor: bigint;
};

export const promotionsService = {
    async list(
        cursor?: string,
        limit = 20,
    ): Promise<PromotionListResponse> {
        const rows = await prisma.promotion.findMany({
            include: { _count: { select: { orders: true } } },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });

        const hasNext = rows.length > limit;
        const items = (hasNext ? rows.slice(0, limit) : rows).map(toDTO);
        const nextCursor = hasNext ? items[items.length - 1].id : null;

        return { items, nextCursor };
    },

    async getById(id: string): Promise<PromotionDTO> {
        const promo = await prisma.promotion.findUnique({
            where: { id },
            include: { _count: { select: { orders: true } } },
        });
        if (!promo) throw AppError.notFound(ErrorCode.PROMOTION_NOT_FOUND, "Promotion not found");
        return toDTO(promo);
    },

    async create(input: PromotionCreateInput): Promise<PromotionDTO> {
        const existing = await prisma.promotion.findUnique({
            where: { code: input.code },
            select: { id: true },
        });
        if (existing) {
            throw AppError.conflict(
                ErrorCode.PROMOTION_CODE_IN_USE,
                `Promotion code "${input.code}" already exists`,
            );
        }

        const promo = await prisma.promotion.create({
            data: {
                code: input.code,
                type: input.type,
                value: input.value,
                minSubtotalMinor: input.minSubtotalMinor,
                maxUses: input.maxUses,
                maxUsesPerUser: input.maxUsesPerUser,
                startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
                endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
                isActive: input.isActive,
            },
            include: { _count: { select: { orders: true } } },
        });

        // Invalidate any stale cache entry for this code.
        await promotionCache.del(`code:${input.code}`);

        return toDTO(promo);
    },

    async update(id: string, input: PromotionUpdateInput): Promise<PromotionDTO> {
        const promo = await prisma.promotion.findUnique({ where: { id } });
        if (!promo) throw AppError.notFound(ErrorCode.PROMOTION_NOT_FOUND, "Promotion not found");

        const updated = await prisma.promotion.update({
            where: { id },
            data: {
                type: input.type,
                value: input.value,
                minSubtotalMinor: input.minSubtotalMinor,
                maxUses: input.maxUses,
                maxUsesPerUser: input.maxUsesPerUser,
                startsAt: input.startsAt !== undefined
                    ? (input.startsAt ? new Date(input.startsAt) : null)
                    : undefined,
                endsAt: input.endsAt !== undefined
                    ? (input.endsAt ? new Date(input.endsAt) : null)
                    : undefined,
                isActive: input.isActive,
            },
            include: { _count: { select: { orders: true } } },
        });

        // Invalidate the cached record for this code (code is immutable).
        await promotionCache.del(`code:${promo.code}`);

        return toDTO(updated);
    },

    /** Validate a promotion code and compute the discount for a given subtotal.
     *  The promotion record lookup is cached; the per-order usage counts always
     *  hit Postgres to prevent coupon abuse. */
    async validate(
        code: string,
        subtotal: bigint,
        userId: string,
    ): Promise<ValidatedPromotion | null> {
        // Cache-aside: try cache first for the promotion record.
        let promo = await promotionCache.get(`code:${code}`);

        if (!promo) {
            const record = await prisma.promotion.findUnique({
                where: { code },
            });
            if (!record) return null;

            promo = toCachedPromotion(record);
            await promotionCache.set(`code:${code}`, promo, CACHE_TTL);
        }

        // Validate from the (possibly cached) record — no DB hit.
        if (!promo.isActive) return null;

        const now = new Date();
        if (promo.startsAt && now < new Date(promo.startsAt)) return null;
        if (promo.endsAt && now > new Date(promo.endsAt)) return null;

        const minSubtotal = promo.minSubtotalMinor ? BigInt(promo.minSubtotalMinor) : null;
        if (minSubtotal && subtotal < minSubtotal) return null;

        // Usage counts exclude orders where the discount was effectively reversed.
        const invalidStatuses: OrderStatus[] = [
            OrderStatus.CANCELLED,
            OrderStatus.FAILED,
            OrderStatus.REFUNDED,
        ];

        if (promo.maxUses !== null) {
            const totalUseCount = await prisma.order.count({
                where: { promotionId: promo.id, status: { notIn: invalidStatuses } },
            });
            if (totalUseCount >= promo.maxUses) return null;
        }

        if (promo.maxUsesPerUser !== null) {
            const userUseCount = await prisma.order.count({
                where: { promotionId: promo.id, userId, status: { notIn: invalidStatuses } },
            });
            if (userUseCount >= promo.maxUsesPerUser) return null;
        }

        const promoValue = BigInt(promo.value);
        const discountMinor =
            promo.type === PromotionType.PERCENTAGE
                ? (subtotal * promoValue + 5000n) / 10000n
                : promoValue > subtotal
                  ? subtotal
                  : promoValue;

        return {
            id: promo.id,
            code: promo.code,
            type: promo.type,
            discountMinor: discountMinor > 0n ? discountMinor : 0n,
        };
    },
};
