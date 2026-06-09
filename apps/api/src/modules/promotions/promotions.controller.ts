import type { PromotionCreateInput, PromotionUpdateInput } from "@repo/shared";
import { promotionsService } from "./promotions.service";
import { asyncHandler } from "../../lib/asyncHandler";
import { userIdOrThrow } from "../../lib/request";

export const listPromotions = asyncHandler(async (req, res) => {
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limitRaw = parseInt(req.query.limit as string, 10);
    const limit = !isNaN(limitRaw) ? Math.min(limitRaw, 50) : 20;
    const result = await promotionsService.list(cursor, limit);
    res.json(result);
});

export const getPromotion = asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const promotion = await promotionsService.getById(id);
    res.json({ promotion });
});

export const createPromotion = asyncHandler(async (req, res) => {
    userIdOrThrow(req);
    const input = req.body as PromotionCreateInput;
    const promotion = await promotionsService.create(input);
    res.status(201).json({ promotion });
});

export const updatePromotion = asyncHandler(async (req, res) => {
    userIdOrThrow(req);
    const id = String(req.params.id);
    const input = req.body as PromotionUpdateInput;
    const promotion = await promotionsService.update(id, input);
    res.json({ promotion });
});
