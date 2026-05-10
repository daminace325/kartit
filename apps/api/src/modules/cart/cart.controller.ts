import { RequestHandler } from "express";
import type { CartAddItemInput, CartUpdateItemInput } from "@repo/shared";
import { cartService } from "./cart.service";
import { AppError } from "../../lib/errors";

function userIdOrThrow(req: Parameters<RequestHandler>[0]): string {
    const id = req.user?.id;
    if (!id) throw AppError.unauthorized();
    return id;
}

export const getCart: RequestHandler = async (req, res, next) => {
    try {
        const cart = await cartService.get(userIdOrThrow(req));
        res.json({ cart });
    } catch (err) {
        next(err);
    }
};

export const addCartItem: RequestHandler = async (req, res, next) => {
    try {
        const { productId, quantity } = req.body as CartAddItemInput;
        const cart = await cartService.addItem(userIdOrThrow(req), productId, quantity);
        res.status(201).json({ cart });
    } catch (err) {
        next(err);
    }
};

export const updateCartItem: RequestHandler = async (req, res, next) => {
    try {
        const productId = String(req.params.productId);
        const { quantity } = req.body as CartUpdateItemInput;
        const cart = await cartService.updateItem(userIdOrThrow(req), productId, quantity);
        res.json({ cart });
    } catch (err) {
        next(err);
    }
};

export const removeCartItem: RequestHandler = async (req, res, next) => {
    try {
        const productId = String(req.params.productId);
        const cart = await cartService.removeItem(userIdOrThrow(req), productId);
        res.json({ cart });
    } catch (err) {
        next(err);
    }
};

export const clearCart: RequestHandler = async (req, res, next) => {
    try {
        const cart = await cartService.clear(userIdOrThrow(req));
        res.json({ cart });
    } catch (err) {
        next(err);
    }
};

export const getCartSummary: RequestHandler = async (req, res, next) => {
    try {
        const summary = await cartService.summary(userIdOrThrow(req));
        res.json(summary);
    } catch (err) {
        next(err);
    }
};
