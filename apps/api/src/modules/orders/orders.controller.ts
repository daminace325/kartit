import { RequestHandler } from "express";
import {
    UserRole,
    type OrderListQuery,
    type OrderStatusUpdateInput,
} from "@repo/shared";
import { ordersService } from "./orders.service";
import { AppError } from "../../lib/errors";

function userOrThrow(req: Parameters<RequestHandler>[0]) {
    const user = req.user;
    if (!user) throw AppError.unauthorized();
    return user;
}

export const createOrder: RequestHandler = async (req, res, next) => {
    try {
        const user = userOrThrow(req);
        const result = await ordersService.create(user.id);
        res.status(201).json(result);
    } catch (err) {
        next(err);
    }
};

export const listOrders: RequestHandler = async (req, res, next) => {
    try {
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
    } catch (err) {
        next(err);
    }
};

export const getOrder: RequestHandler = async (req, res, next) => {
    try {
        const user = userOrThrow(req);
        const id = String(req.params.id);
        const order = await ordersService.getById(
            user.id,
            user.role === UserRole.ADMIN,
            id,
        );
        res.json({ order });
    } catch (err) {
        next(err);
    }
};

export const cancelOrder: RequestHandler = async (req, res, next) => {
    try {
        const user = userOrThrow(req);
        const id = String(req.params.id);
        const order = await ordersService.cancel(
            user.id,
            user.role === UserRole.ADMIN,
            id,
        );
        res.json({ order });
    } catch (err) {
        next(err);
    }
};

export const updateOrderStatus: RequestHandler = async (req, res, next) => {
    try {
        const id = String(req.params.id);
        const { status } = req.body as OrderStatusUpdateInput;
        const order = await ordersService.adminUpdateStatus(id, status);
        res.json({ order });
    } catch (err) {
        next(err);
    }
};
