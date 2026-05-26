import type {
    CategoryCreateInput,
    CategoryListQuery,
    CategoryUpdateInput,
} from "@repo/shared";
import { categoriesService } from "./categories.service";
import { asyncHandler } from "../../lib/asyncHandler";

export const listCategories = asyncHandler(async (req, res) => {
    const query: CategoryListQuery = {};
    if (typeof req.query.parentId === "string") {
        query.parentId = req.query.parentId;
    }
    if (req.query.includeInactive === "true") {
        query.includeInactive = "true";
    }
    const categories = await categoriesService.list(query);
    res.json({ categories });
});

export const getCategoryById = asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const includeInactive = req.query.includeInactive === "true";
    const category = await categoriesService.getById(id, { includeInactive });
    res.json({ category });
});

export const getCategoryBySlug = asyncHandler(async (req, res) => {
    const slug = String(req.params.slug);
    const category = await categoriesService.getBySlug(slug);
    res.json({ category });
});

export const createCategory = asyncHandler(async (req, res) => {
    const category = await categoriesService.create(req.body as CategoryCreateInput);
    res.status(201).json({ category });
});

export const updateCategory = asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const category = await categoriesService.update(id, req.body as CategoryUpdateInput);
    res.json({ category });
});

export const deleteCategory = asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    await categoriesService.remove(id);
    res.json({ ok: true });
});
