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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDTO(promo: any): PromotionDTO {
    return {
        id: promo.id,
        code: promo.code,
        type: promo.type as PromotionType,
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

        return toDTO(updated);
    },

    /** Validate a promotion code and compute the discount for a given subtotal. */
    async validate(
        code: string,
        subtotal: bigint,
        userId: string,
    ): Promise<ValidatedPromotion | null> {
        const promo = await prisma.promotion.findUnique({
            where: { code },
        });

        if (!promo) return null;
        if (!promo.isActive) return null;

        const now = new Date();
        if (promo.startsAt && now < promo.startsAt) return null;
        if (promo.endsAt && now > promo.endsAt) return null;

        if (promo.minSubtotalMinor && subtotal < promo.minSubtotalMinor) return null;

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

        const discountMinor =
            promo.type === PromotionType.PERCENTAGE
                ? (subtotal * promo.value) / 10000n
                : promo.value > subtotal
                  ? subtotal
                  : promo.value;

        return {
            id: promo.id,
            code: promo.code,
            type: promo.type as PromotionType,
            discountMinor: discountMinor > 0n ? discountMinor : 0n,
        };
    },
};
