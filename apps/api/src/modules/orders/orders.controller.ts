import type { RequestHandler } from "express";
import {
    UserRole,
    type OrderCreateInput,
    type OrderListQuery,
    type OrderStatusUpdateInput,
} from "@repo/shared";
import { ordersService } from "./orders.service";
import { AppError } from "../../lib/errors";
import { asyncHandler } from "../../lib/asyncHandler";

function userOrThrow(req: Parameters<RequestHandler>[0]) {
    const user = req.user;
    if (!user) throw AppError.unauthorized();
    return user;
}

export const createOrder = asyncHandler(async (req, res) => {
    const user = userOrThrow(req);
    const input = req.body as OrderCreateInput;
    const result = await ordersService.create(user.id, input);
    res.status(201).json(result);
});

export const listOrders = asyncHandler(async (req, res) => {
    const user = userOrThrow(req);
    const query = req.query as unknown as OrderListQuery;
    const isAdmin = user.role === UserRole.ADMIN;
    // Only treat the request as "list every order" when an admin
    // explicitly opts in via ?scope=all. The default /orders view
    // (e.g. the customer-facing "Your orders" page) must always be
    // scoped to the caller, even for admins.
    const allOrders = isAdmin && query.scope === "all";
    const result = await ordersService.list(user.id, allOrders, query);
    res.json(result);
});

export const getOrder = asyncHandler(async (req, res) => {
    const user = userOrThrow(req);
    const id = String(req.params.id);
    const order = await ordersService.getById(
        user.id,
        user.role === UserRole.ADMIN,
        id,
    );
    res.json({ order });
});

export const cancelOrder = asyncHandler(async (req, res) => {
    const user = userOrThrow(req);
    const id = String(req.params.id);
    const order = await ordersService.cancel(
        user.id,
        user.role === UserRole.ADMIN,
        id,
    );
    res.json({ order });
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const { status } = req.body as OrderStatusUpdateInput;
    const order = await ordersService.adminUpdateStatus(id, status);
    res.json({ order });
});

export const refundOrder = asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const result = await ordersService.refundOrder(id);
    // Return 202 Accepted - refund is async, actual status flip via webhook
    res.status(202).json(result);
});
