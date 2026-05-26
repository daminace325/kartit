import { Router } from "express";
import { promotionCreateSchema, promotionUpdateSchema } from "@repo/shared";
import { validate } from "../../middlewares/validate";
import { requireAdmin, requireAuth } from "../../middlewares/requireAuth";
import {
    listPromotions,
    getPromotion,
    createPromotion,
    updatePromotion,
} from "./promotions.controller";

export const promotionsRouter: Router = Router();

promotionsRouter.use(requireAuth);

// Admin-only write endpoints.
promotionsRouter.post("/", requireAdmin, validate(promotionCreateSchema), createPromotion);
promotionsRouter.patch("/:id", requireAdmin, validate(promotionUpdateSchema), updatePromotion);

// Read endpoints accessible by any authenticated user.
promotionsRouter.get("/", listPromotions);
promotionsRouter.get("/:id", getPromotion);
