import { Router } from "express";
import {
    orderCreateSchema,
    orderListQuerySchema,
    orderStatusUpdateSchema,
} from "@repo/shared";
import { validate } from "../../middlewares/validate";
import { requireAdmin, requireAuth } from "../../middlewares/requireAuth";
import { idempotency } from "../../middlewares/idempotency";
import {
    cancelOrder,
    createOrder,
    getOrder,
    listOrders,
    updateOrderStatus,
} from "./orders.controller";

export const ordersRouter: Router = Router();

// All order routes require an authenticated user.
ordersRouter.use(requireAuth);

ordersRouter.get("/", validate(orderListQuerySchema, "query"), listOrders);
ordersRouter.post("/", validate(orderCreateSchema), idempotency, createOrder);
ordersRouter.get("/:id", getOrder);
ordersRouter.post("/:id/cancel", cancelOrder);
ordersRouter.patch(
    "/:id/status",
    requireAdmin,
    validate(orderStatusUpdateSchema),
    updateOrderStatus,
);
