import { RequestHandler } from "express";
import type {
    ProductCreateInput,
    ProductListQuery,
    ProductUpdateInput,
} from "@repo/shared";
import { productsService } from "./products.service";

export const listProducts: RequestHandler = async (req, res, next) => {
    try {
        const query = req.query as unknown as ProductListQuery;
        const result = await productsService.list(query);
        res.json(result);
    } catch (err) {
        next(err);
    }
};

export const getProductById: RequestHandler = async (req, res, next) => {
    try {
        const id = String(req.params.id);
        const product = await productsService.getById(id);
        res.json({ product });
    } catch (err) {
        next(err);
    }
};

export const getProductBySlug: RequestHandler = async (req, res, next) => {
    try {
        const slug = String(req.params.slug);
        const product = await productsService.getBySlug(slug);
        res.json({ product });
    } catch (err) {
        next(err);
    }
};

export const createProduct: RequestHandler = async (req, res, next) => {
    try {
        const product = await productsService.create(req.body as ProductCreateInput);
        res.status(201).json({ product });
    } catch (err) {
        next(err);
    }
};

export const updateProduct: RequestHandler = async (req, res, next) => {
    try {
        const id = String(req.params.id);
        const product = await productsService.update(id, req.body as ProductUpdateInput);
        res.json({ product });
    } catch (err) {
        next(err);
    }
};

export const deleteProduct: RequestHandler = async (req, res, next) => {
    try {
        const id = String(req.params.id);
        await productsService.remove(id);
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
};
