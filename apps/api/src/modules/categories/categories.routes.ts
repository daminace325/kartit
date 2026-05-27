import { Router } from "express";
import { categoryCreateSchema, categoryUpdateSchema, idParamSchema, slugParamSchema } from "@repo/shared";
import { validate } from "../../middlewares/validate";
import { requireAdmin, requireAuth } from "../../middlewares/requireAuth";
import {
    createCategory,
    deleteCategory,
    getCategoryById,
    getCategoryBySlug,
    listCategories,
    updateCategory,
} from "./categories.controller";

export const categoriesRouter: Router = Router();

// Public reads
categoriesRouter.get("/", listCategories);
categoriesRouter.get("/slug/:slug", validate(slugParamSchema, "params"), getCategoryBySlug);
categoriesRouter.get("/:id", validate(idParamSchema, "params"), getCategoryById);

// Admin writes
categoriesRouter.post(
    "/",
    requireAuth,
    requireAdmin,
    validate(categoryCreateSchema),
    createCategory,
);
categoriesRouter.put(
    "/:id",
    requireAuth,
    requireAdmin,
    validate(idParamSchema, "params"),
    validate(categoryUpdateSchema),
    updateCategory,
);
categoriesRouter.delete("/:id", requireAuth, requireAdmin, validate(idParamSchema, "params"), deleteCategory);
