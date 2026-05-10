import { Router } from "express";
import {
    productCreateSchema,
    productListQuerySchema,
    productUpdateSchema,
} from "@repo/shared";
import { validate } from "../../middlewares/validate";
import { requireAdmin, requireAuth } from "../../middlewares/requireAuth";
import {
    createProduct,
    deleteProduct,
    getProductById,
    getProductBySlug,
    listProducts,
    updateProduct,
} from "./products.controller";

export const productsRouter: Router = Router();

// Public reads
productsRouter.get("/", validate(productListQuerySchema, "query"), listProducts);
productsRouter.get("/slug/:slug", getProductBySlug);
productsRouter.get("/:id", getProductById);

// Admin writes
productsRouter.post(
    "/",
    requireAuth,
    requireAdmin,
    validate(productCreateSchema),
    createProduct,
);
productsRouter.put(
    "/:id",
    requireAuth,
    requireAdmin,
    validate(productUpdateSchema),
    updateProduct,
);
productsRouter.delete("/:id", requireAuth, requireAdmin, deleteProduct);
