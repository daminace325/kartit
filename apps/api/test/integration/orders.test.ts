import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@repo/db";
import { OrderStatus } from "@repo/shared";
import {
    makeApp,
    request,
    cleanDb,
    createTestUser,
    createTestProduct,
} from "../helpers";

let app = makeApp();

async function addToCart(token: string, productId: string, quantity = 1) {
    return request(app)
        .post("/cart/items")
        .set("Cookie", `ecomm_auth=${token}`)
        .set("X-Requested-With", "fetch")
        .send({ productId, quantity });
}

async function createAddress(token: string, overrides?: Record<string, string>) {
    return request(app)
        .post("/addresses")
        .set("Cookie", `ecomm_auth=${token}`)
        .set("X-Requested-With", "fetch")
        .send({
            name: overrides?.name ?? "Home",
            phone: overrides?.phone ?? "1234567890",
            line1: overrides?.line1 ?? "123 Main St",
            city: overrides?.city ?? "Testville",
            state: overrides?.state ?? "TS",
            postalCode: overrides?.postalCode ?? "12345",
            country: overrides?.country ?? "US",
        });
}

describe("Orders API", () => {
    beforeEach(async () => {
        await cleanDb();
        app = makeApp();
    });

    describe("POST /orders", () => {
        it("creates an order with shipping address", async () => {
            const { token } = await createTestUser();
            const product = await createTestProduct({ physicalStock: 50 });
            await addToCart(token, product.id, 3);
            const addrRes = await createAddress(token);
            const addressId = addrRes.body.address.id;

            const res = await request(app)
                .post("/orders")
                .set("Cookie", `ecomm_auth=${token}`)
                .set("X-Requested-With", "fetch")
                .send({ shippingAddressId: addressId });

            expect(res.status).toBe(201);
            expect(res.body.order.status).toBe(OrderStatus.PENDING);
            expect(res.body.order.items).toHaveLength(1);
            expect(res.body.order.items[0].productName).toBe("Test Product");
            expect(res.body.order.items[0].quantity).toBe(3);

            // Stock should be reserved (reservedQty = 3, physicalStock unchanged)
            const updated = await prisma.product.findUnique({
                where: { id: product.id },
            });
            expect(updated!.physicalStock).toBe(50);
            expect(updated!.reservedQty).toBe(3);

            // Cart should be empty
            const cartRes = await request(app)
                .get("/cart")
                .set("Cookie", `ecomm_auth=${token}`);
            expect(cartRes.body.cart.items).toHaveLength(0);
        });

        it("returns 400 for empty cart", async () => {
            const { token } = await createTestUser();
            const addrRes = await createAddress(token);
            const addressId = addrRes.body.address.id;

            // Don't add anything to cart — attempt order with empty cart
            const res = await request(app)
                .post("/orders")
                .set("Cookie", `ecomm_auth=${token}`)
                .set("X-Requested-With", "fetch")
                .send({ shippingAddressId: addressId });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("CART_EMPTY");
        });

        it("supports idempotency via Idempotency-Key header", async () => {
            const { token } = await createTestUser();
            const product = await createTestProduct({ physicalStock: 50 });
            await addToCart(token, product.id, 2);
            const addrRes = await createAddress(token);
            const addressId = addrRes.body.address.id;

            const makeReq = () =>
                request(app)
                    .post("/orders")
                    .set("Cookie", `ecomm_auth=${token}`)
                    .set("X-Requested-With", "fetch")
                    .set("Idempotency-Key", "test-idem-key-1")
                    .send({ shippingAddressId: addressId });

            const res1 = await makeReq();
            expect(res1.status).toBe(201);
            const orderId = res1.body.order.id;

            // Second request with same key — replays cached response (201)
            const res2 = await makeReq();
            expect(res2.status).toBe(201);
            expect(res2.body.order.id).toBe(orderId);

            // Stock should only be reserved once
            const updated = await prisma.product.findUnique({
                where: { id: product.id },
            });
            expect(updated!.physicalStock).toBe(50);
            expect(updated!.reservedQty).toBe(2); // 2 reserved, not 4
        });
    });

    describe("GET /orders", () => {
        it("lists user's orders", async () => {
            const { token } = await createTestUser();
            const product = await createTestProduct({ physicalStock: 50 });
            await addToCart(token, product.id, 2);
            const addrRes = await createAddress(token);

            await request(app)
                .post("/orders")
                .set("Cookie", `ecomm_auth=${token}`)
                .set("X-Requested-With", "fetch")
                .send({ shippingAddressId: addrRes.body.address.id });

            const res = await request(app)
                .get("/orders")
                .set("Cookie", `ecomm_auth=${token}`);

            expect(res.status).toBe(200);
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].status).toBe(OrderStatus.PENDING);
        });

        it("another user cannot see someone else's orders", async () => {
            const user1 = await createTestUser({ email: "u1@example.com" });
            const product = await createTestProduct({ physicalStock: 50 });
            await addToCart(user1.token, product.id, 2);
            const addrRes = await createAddress(user1.token);

            await request(app)
                .post("/orders")
                .set("Cookie", `ecomm_auth=${user1.token}`)
                .set("X-Requested-With", "fetch")
                .send({ shippingAddressId: addrRes.body.address.id });

            const user2 = await createTestUser({ email: "u2@example.com" });
            const res = await request(app)
                .get("/orders")
                .set("Cookie", `ecomm_auth=${user2.token}`);

            expect(res.body.items).toHaveLength(0);
        });
    });

    describe("POST /orders/:id/cancel", () => {
        it("cancels a PENDING order and restores stock", async () => {
            const { token } = await createTestUser();
            const product = await createTestProduct({ physicalStock: 50 });
            await addToCart(token, product.id, 5);
            const addrRes = await createAddress(token);

            const orderRes = await request(app)
                .post("/orders")
                .set("Cookie", `ecomm_auth=${token}`)
                .set("X-Requested-With", "fetch")
                .send({ shippingAddressId: addrRes.body.address.id });

            const orderId = orderRes.body.order.id;

            const cancelRes = await request(app)
                .post(`/orders/${orderId}/cancel`)
                .set("Cookie", `ecomm_auth=${token}`)
                .set("X-Requested-With", "fetch");

            expect(cancelRes.status).toBe(200);
            expect(cancelRes.body.order.status).toBe(OrderStatus.CANCELLED);

            // Stock restored — reservation released, physicalStock unchanged
            const updated = await prisma.product.findUnique({
                where: { id: product.id },
            });
            expect(updated!.physicalStock).toBe(50);
            expect(updated!.reservedQty).toBe(0);
        });

        it("does not allow cancelling a non-PENDING order", async () => {
            const { token } = await createTestUser();
            const product = await createTestProduct({ physicalStock: 50 });
            await addToCart(token, product.id, 1);
            const addrRes = await createAddress(token);

            const orderRes = await request(app)
                .post("/orders")
                .set("Cookie", `ecomm_auth=${token}`)
                .set("X-Requested-With", "fetch")
                .send({ shippingAddressId: addrRes.body.address.id });

            const orderId = orderRes.body.order.id;

            // Direct DB mutation to simulate admin flipping to DELIVERED
            await prisma.order.update({
                where: { id: orderId },
                data: { status: OrderStatus.DELIVERED },
            });

            const cancelRes = await request(app)
                .post(`/orders/${orderId}/cancel`)
                .set("Cookie", `ecomm_auth=${token}`)
                .set("X-Requested-With", "fetch");

            expect(cancelRes.status).toBe(409);
            expect(cancelRes.body.error.code).toBe("ORDER_INVALID_STATE");
        });
    });
});
