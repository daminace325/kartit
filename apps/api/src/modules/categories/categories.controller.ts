import { RequestHandler } from "express";
import type {
    CategoryCreateInput,
    CategoryListQuery,
    CategoryUpdateInput,
} from "@repo/shared";
import { categoriesService } from "./categories.service";

export const listCategories: RequestHandler = async (req, res, next) => {
    try {
        const query: CategoryListQuery = {};
        if (typeof req.query.parentId === "string") {
            query.parentId = req.query.parentId;
        }
        const categories = await categoriesService.list(query);
        res.json({ categories });
    } catch (err) {
        next(err);
    }
};

export const getCategoryById: RequestHandler = async (req, res, next) => {
    try {
        const id = String(req.params.id);
        const category = await categoriesService.getById(id);
        res.json({ category });
    } catch (err) {
        next(err);
    }
};

export const getCategoryBySlug: RequestHandler = async (req, res, next) => {
    try {
        const slug = String(req.params.slug);
        const category = await categoriesService.getBySlug(slug);
        res.json({ category });
    } catch (err) {
        next(err);
    }
};

export const createCategory: RequestHandler = async (req, res, next) => {
    try {
        const category = await categoriesService.create(req.body as CategoryCreateInput);
        res.status(201).json({ category });
    } catch (err) {
        next(err);
    }
};

export const updateCategory: RequestHandler = async (req, res, next) => {
    try {
        const id = String(req.params.id);
        const category = await categoriesService.update(id, req.body as CategoryUpdateInput);
        res.json({ category });
    } catch (err) {
        next(err);
    }
};

export const deleteCategory: RequestHandler = async (req, res, next) => {
    try {
        const id = String(req.params.id);
        await categoriesService.remove(id);
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
};
