import type {
    ProductCreateInput,
    ProductListQuery,
    ProductUpdateInput,
} from "@repo/shared";
import { productsService } from "./products.service";
import { asyncHandler } from "../../lib/asyncHandler";

export const listProducts = asyncHandler(async (req, res) => {
    const query = req.query as unknown as ProductListQuery;
    const result = await productsService.list(query);
    res.json(result);
});

export const getProductById = asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const product = await productsService.getById(id);
    res.json({ product });
});

export const getProductBySlug = asyncHandler(async (req, res) => {
    const slug = String(req.params.slug);
    const product = await productsService.getBySlug(slug);
    res.json({ product });
});

export const createProduct = asyncHandler(async (req, res) => {
    const product = await productsService.create(req.body as ProductCreateInput);
    res.status(201).json({ product });
});

export const updateProduct = asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const product = await productsService.update(id, req.body as ProductUpdateInput);
    res.json({ product });
});

export const deleteProduct = asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    await productsService.remove(id);
    res.json({ ok: true });
});
