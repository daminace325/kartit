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
    refundOrder,
    updateOrderStatus,
    requestRefund,
    approveRefundRequest,
    rejectRefundRequest,
    listRefundRequests,
    getRefundRequestByOrder,
} from "./orders.controller";

export const ordersRouter: Router = Router();

// All order routes require an authenticated user.
ordersRouter.use(requireAuth);

ordersRouter.get("/", validate(orderListQuerySchema, "query"), listOrders);
ordersRouter.post("/", validate(orderCreateSchema), idempotency, createOrder);

// Refund request admin endpoints — must be before /:id routes.
ordersRouter.get("/refund-requests", requireAdmin, listRefundRequests);
ordersRouter.post("/refund-requests/:id/approve", requireAdmin, approveRefundRequest);
ordersRouter.post("/refund-requests/:id/reject", requireAdmin, rejectRefundRequest);

ordersRouter.get("/:id", getOrder);
ordersRouter.post("/:id/cancel", cancelOrder);
ordersRouter.patch(
    "/:id/status",
    requireAdmin,
    validate(orderStatusUpdateSchema),
    updateOrderStatus,
);
ordersRouter.post("/:id/refund", requireAdmin, refundOrder);
ordersRouter.post("/:id/request-refund", requestRefund);
ordersRouter.get("/:id/refund-request", getRefundRequestByOrder);
