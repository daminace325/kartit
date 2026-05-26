import { z } from "../lib/zod";
import { OrderStatus } from "../enums";

export const orderCreateSchema = z.object({
    shippingAddressId: z.string().min(1),
    promotionCode: z.string().min(1).optional(),
});
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;

export const paymentIntentSchema = z.object({
    orderId: z.string().min(1),
});
export type PaymentIntentInput = z.infer<typeof paymentIntentSchema>;

export const orderListQuerySchema = z.object({
    cursor: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    // "mine" (default) returns only the caller's orders, even for admins.
    // "all" is admin-only and returns every user's orders (used by the
    // admin dashboard). Non-admins requesting "all" are silently scoped
    // back to their own orders by the controller.
    scope: z.enum(["mine", "all"]).default("mine"),
});
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;

// Admin-only status update. Cancellation by the customer goes through
// the dedicated POST /orders/:id/cancel route.
export const orderStatusUpdateSchema = z.object({
    status: z.enum([
        OrderStatus.PENDING,
        OrderStatus.PAID,
        OrderStatus.PROCESSING,
        OrderStatus.SHIPPED,
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED,
        OrderStatus.FAILED,
    ]),
});
export type OrderStatusUpdateInput = z.infer<typeof orderStatusUpdateSchema>;

export type OrderItemDTO = {
    id: string;
    productId: string;
    productName: string;
    productSlug: string;
    imageUrl: string | null;
    unitPriceMinor: string;
    currency: string;
    quantity: number;
    totalMinor: string;
};

export type OrderDTO = {
    id: string;
    orderNumber: string;
    userId: string;
    status: OrderStatus;
    subtotalMinor: string;
    shippingMinor: string;
    taxMinor: string;
    discountMinor: string;
    totalMinor: string;
    currency: string;
    promotionCode: string | null;
    shippingName: string;
    shippingPhone: string;
    shippingLine1: string;
    shippingLine2: string | null;
    shippingCity: string;
    shippingState: string | null;
    shippingPostalCode: string;
    shippingCountry: string;
    items: OrderItemDTO[];
    paidAt: string | null;
    deliveredAt: string | null;
    createdAt: string;
    updatedAt: string;
};

export type CreateOrderResponse = {
    order: OrderDTO;
};

export type PaymentIntentResponse = {
    clientSecret: string;
    order: OrderDTO;
};

export type OrderListResponse = {
    items: OrderDTO[];
    nextCursor: string | null;
};
