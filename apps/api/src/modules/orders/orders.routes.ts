import { Router } from "express";
import {
    orderCreateSchema,
    orderListQuerySchema,
    orderStatusUpdateSchema,
    refundRequestBodySchema,
    refundRequestListQuerySchema,
    idParamSchema,
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
ordersRouter.get("/refund-requests", requireAdmin, validate(refundRequestListQuerySchema, "query"), listRefundRequests);
ordersRouter.post("/refund-requests/:id/approve", requireAdmin, validate(idParamSchema, "params"), approveRefundRequest);
ordersRouter.post("/refund-requests/:id/reject", requireAdmin, validate(idParamSchema, "params"), rejectRefundRequest);

ordersRouter.get("/:id", validate(idParamSchema, "params"), getOrder);
ordersRouter.post("/:id/cancel", validate(idParamSchema, "params"), cancelOrder);
ordersRouter.patch(
    "/:id/status",
    requireAdmin,
    validate(idParamSchema, "params"),
    validate(orderStatusUpdateSchema),
    updateOrderStatus,
);
ordersRouter.post("/:id/refund", requireAdmin, validate(idParamSchema, "params"), refundOrder);
ordersRouter.post("/:id/request-refund", validate(idParamSchema, "params"), validate(refundRequestBodySchema), requestRefund);
ordersRouter.get("/:id/refund-request", validate(idParamSchema, "params"), getRefundRequestByOrder);
