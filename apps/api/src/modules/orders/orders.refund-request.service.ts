import { prisma } from "@repo/db";
import { OrderStatus, REFUND_WINDOW_DAYS } from "@repo/shared";
import { AppError } from "../../lib/errors";

export interface RefundRequestDTO {
    id: string;
    orderId: string;
    userId: string;
    status: string;
    reason: string | null;
    reviewedBy: string | null;
    reviewedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface RefundRequestListDTO extends RefundRequestDTO {
    order: {
        totalMinor: string;
        currency: string;
        userId: string;
        shippingName: string;
    };
}

type RefundRequestRow = Awaited<
    ReturnType<typeof prisma.refundRequest.findUniqueOrThrow>
>;

type RefundRequestListRow = Awaited<
    ReturnType<typeof prisma.refundRequest.findMany>
>[number] & {
    order: {
        totalMinor: bigint;
        currency: string;
        userId: string;
        shippingName: string;
    };
};

function toDTO(row: NonNullable<RefundRequestRow>): RefundRequestDTO {
    return {
        id: row.id,
        orderId: row.orderId,
        userId: row.userId,
        status: row.status,
        reason: row.reason,
        reviewedBy: row.reviewedBy,
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}

function toListDTO(row: RefundRequestListRow): RefundRequestListDTO {
    return {
        ...toDTO(row),
        order: {
            totalMinor: row.order.totalMinor.toString(),
            currency: row.order.currency,
            userId: row.order.userId,
            shippingName: row.order.shippingName,
        },
    };
}

export const refundRequestService = {
    async request(
        userId: string,
        orderId: string,
        reason?: string,
    ): Promise<RefundRequestDTO> {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
        });

        if (!order) {
            throw AppError.notFound("NOT_FOUND", "Order not found");
        }
        if (order.userId !== userId) {
            throw AppError.forbidden();
        }
        if (order.status !== OrderStatus.DELIVERED) {
            throw AppError.conflict(
                "INVALID_STATUS",
                "Refunds are only available for delivered orders",
            );
        }

        const deliveredAt = order.deliveredAt ?? order.updatedAt;
        const deadline = new Date(deliveredAt);
        deadline.setDate(deadline.getDate() + REFUND_WINDOW_DAYS);

        if (new Date() > deadline) {
            throw AppError.conflict(
                "REFUND_WINDOW_EXPIRED",
                `Refund window closed. Requests must be made within ${REFUND_WINDOW_DAYS} days of delivery.`,
            );
        }

        try {
            const created = await prisma.refundRequest.create({
                data: {
                    orderId,
                    userId,
                    reason: reason ?? null,
                },
            });
            return toDTO(created);
        } catch {
            throw AppError.conflict(
                "DUPLICATE_REQUEST",
                "A refund request already exists for this order",
            );
        }
    },

    async approve(
        adminUserId: string,
        requestId: string,
        executeRefund: (
            orderId: string,
        ) => Promise<{ refundId: string }>,
    ): Promise<RefundRequestDTO> {
        const existing = await prisma.refundRequest.findUnique({
            where: { id: requestId },
        });

        if (!existing) {
            throw AppError.notFound("NOT_FOUND", "Refund request not found");
        }
        if (existing.status !== "PENDING") {
            throw AppError.conflict(
                "ALREADY_PROCESSED",
                `Refund request has already been ${existing.status.toLowerCase()}`,
            );
        }

        // Mark APPROVED first via conditional update — this prevents
        // concurrent approvers from issuing duplicate Stripe refunds.
        const approved = await prisma.refundRequest.updateMany({
            where: { id: requestId, status: "PENDING" },
            data: {
                status: "APPROVED",
                reviewedBy: adminUserId,
                reviewedAt: new Date(),
            },
        });
        if (approved.count !== 1) {
            throw AppError.conflict(
                "ALREADY_PROCESSED",
                "Refund request has already been processed",
            );
        }

        // Execute Stripe refund. If Stripe fails, revert the request
        // back to PENDING so the admin can retry without data loss.
        try {
            await executeRefund(existing.orderId);
        } catch {
            await prisma.refundRequest.update({
                where: { id: requestId },
                data: { status: "PENDING" },
            });
            throw AppError.internal(
                "STRIPE_REFUND_FAILED",
                "Stripe refund failed — request reverted to PENDING, please retry",
            );
        }

        const row = await prisma.refundRequest.findUniqueOrThrow({
            where: { id: requestId },
        });
        return toDTO(row);
    },

    async reject(
        adminUserId: string,
        requestId: string,
    ): Promise<RefundRequestDTO> {
        const existing = await prisma.refundRequest.findUnique({
            where: { id: requestId },
        });

        if (!existing) {
            throw AppError.notFound("NOT_FOUND", "Refund request not found");
        }
        if (existing.status !== "PENDING") {
            throw AppError.conflict(
                "ALREADY_PROCESSED",
                `Refund request has already been ${existing.status.toLowerCase()}`,
            );
        }

        const rejected = await prisma.refundRequest.update({
            where: { id: requestId },
            data: {
                status: "REJECTED",
                reviewedBy: adminUserId,
                reviewedAt: new Date(),
            },
        });

        return toDTO(rejected);
    },

    async list(params: {
        status?: string;
        cursor?: string;
        limit?: number;
    }): Promise<{ items: RefundRequestListDTO[]; nextCursor: string | null }> {
        const { status, cursor, limit = 20 } = params;

        const rows = (await prisma.refundRequest.findMany({
            where: status ? { status: status as never } : {},
            include: {
                order: {
                    select: {
                        totalMinor: true,
                        currency: true,
                        userId: true,
                        shippingName: true,
                    },
                },
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: limit + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        })) as RefundRequestListRow[];

        const hasNext = rows.length > limit;
        const items = (hasNext ? rows.slice(0, limit) : rows).map(toListDTO);
        const nextCursor = hasNext ? items[items.length - 1].id : null;

        return { items, nextCursor };
    },

    async getByOrderId(
        userId: string,
        isAdmin: boolean,
        orderId: string,
    ): Promise<RefundRequestDTO | null> {
        // Verify ownership before returning the refund request.
        // The order lookup also serves as an existence check.
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: { userId: true },
        });
        if (!order) return null;
        if (!isAdmin && order.userId !== userId) {
            throw AppError.forbidden();
        }

        const row = await prisma.refundRequest.findUnique({
            where: { orderId },
        });
        return row ? toDTO(row) : null;
    },
};
