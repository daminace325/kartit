import { Router } from "express";
import { cartAddItemSchema, cartUpdateItemSchema, cartSummarySchema, productIdParamSchema } from "@repo/shared";
import { validate } from "../../middlewares/validate";
import { requireAuth } from "../../middlewares/requireAuth";
import {
    addCartItem,
    clearCart,
    getCart,
    getCartSummary,
    removeCartItem,
    updateCartItem,
} from "./cart.controller";

export const cartRouter: Router = Router();

// All cart routes require an authenticated user.
cartRouter.use(requireAuth);

cartRouter.get("/", getCart);
cartRouter.post("/items", validate(cartAddItemSchema), addCartItem);
cartRouter.patch(
    "/items/:productId",
    validate(productIdParamSchema, "params"),
    validate(cartUpdateItemSchema),
    updateCartItem,
);
cartRouter.delete("/items/:productId", validate(productIdParamSchema, "params"), removeCartItem);
cartRouter.delete("/", clearCart);
cartRouter.post("/summary", validate(cartSummarySchema), getCartSummary);
