import type { RequestHandler } from "express";
import type { CartAddItemInput, CartUpdateItemInput } from "@repo/shared";
import { cartService } from "./cart.service";
import { AppError } from "../../lib/errors";
import { asyncHandler } from "../../lib/asyncHandler";

function userIdOrThrow(req: Parameters<RequestHandler>[0]): string {
    const id = req.user?.id;
    if (!id) throw AppError.unauthorized();
    return id;
}

export const getCart = asyncHandler(async (req, res) => {
    const cart = await cartService.get(userIdOrThrow(req));
    res.json({ cart });
});

export const addCartItem = asyncHandler(async (req, res) => {
    const { productId, quantity } = req.body as CartAddItemInput;
    const cart = await cartService.addItem(userIdOrThrow(req), productId, quantity);
    res.status(201).json({ cart });
});

export const updateCartItem = asyncHandler(async (req, res) => {
    const productId = String(req.params.productId);
    const { quantity } = req.body as CartUpdateItemInput;
    const cart = await cartService.updateItem(userIdOrThrow(req), productId, quantity);
    res.json({ cart });
});

export const removeCartItem = asyncHandler(async (req, res) => {
    const productId = String(req.params.productId);
    const cart = await cartService.removeItem(userIdOrThrow(req), productId);
    res.json({ cart });
});

export const clearCart = asyncHandler(async (req, res) => {
    const cart = await cartService.clear(userIdOrThrow(req));
    res.json({ cart });
});

export const getCartSummary = asyncHandler(async (req, res) => {
    const promotionCode = (req.body as { promotionCode?: string }).promotionCode;
    const summary = await cartService.summary(userIdOrThrow(req), promotionCode);
    res.json(summary);
});
