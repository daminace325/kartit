import { Router } from "express";
import { categoryCreateSchema, categoryUpdateSchema } from "@repo/shared";
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
categoriesRouter.get("/slug/:slug", getCategoryBySlug);
categoriesRouter.get("/:id", getCategoryById);

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
    validate(categoryUpdateSchema),
    updateCategory,
);
categoriesRouter.delete("/:id", requireAuth, requireAdmin, deleteCategory);
