import type { RequestHandler } from "express";
import {
    UserRole,
    type OrderCreateInput,
    type OrderListQuery,
    type OrderStatusUpdateInput,
} from "@repo/shared";
import { ordersService } from "./orders.service";
import { ordersStatusService } from "./orders.status.service";
import { ordersPaymentService } from "./orders.payment.service";
import { AppError } from "../../lib/errors";
import { asyncHandler } from "../../lib/asyncHandler";

function userIdOrThrow(req: Parameters<RequestHandler>[0]): string {
    const id = req.user?.id;
    if (!id) throw AppError.unauthorized();
    return id;
}

export const createOrder = asyncHandler(async (req, res) => {
    const userId = userIdOrThrow(req);
    const input = req.body as OrderCreateInput;
    const result = await ordersService.create(userId, input);
    res.status(201).json(result);
});

export const listOrders = asyncHandler(async (req, res) => {
    const userId = userIdOrThrow(req);
    const query = req.query as unknown as OrderListQuery;
    const isAdmin = req.user!.role === UserRole.ADMIN;
    const allOrders = isAdmin && query.scope === "all";
    const result = await ordersService.list(userId, allOrders, query);
    res.json(result);
});

export const getOrder = asyncHandler(async (req, res) => {
    const userId = userIdOrThrow(req);
    const id = String(req.params.id);
    const order = await ordersService.getById(
        userId,
        req.user!.role === UserRole.ADMIN,
        id,
    );
    res.json({ order });
});

export const cancelOrder = asyncHandler(async (req, res) => {
    const userId = userIdOrThrow(req);
    const id = String(req.params.id);
    const order = await ordersService.cancel(
        userId,
        req.user!.role === UserRole.ADMIN,
        id,
    );
    res.json({ order });
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const { status } = req.body as OrderStatusUpdateInput;
    const order = await ordersStatusService.adminUpdateStatus(id, status);
    res.json({ order });
});

export const refundOrder = asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const result = await ordersPaymentService.refundOrder(id);
    res.status(202).json(result);
});
