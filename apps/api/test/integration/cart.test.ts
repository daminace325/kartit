import { describe, it, expect, beforeEach } from "vitest";
import { makeApp, request, cleanDb, createTestUser, createTestProduct } from "../helpers";

let app = makeApp();

async function addToCart(token: string, productId: string, quantity = 1) {
    return request(app)
        .post("/cart/items")
        .set("Cookie", `ecomm_auth=${token}`)
        .set("X-Requested-With", "fetch")
        .send({ productId, quantity });
}

describe("Cart API", () => {
    beforeEach(async () => {
        await cleanDb();
        app = makeApp();
    });

    describe("GET /cart", () => {
        it("returns empty cart for new user", async () => {
            const { token } = await createTestUser();

            const res = await request(app)
                .get("/cart")
                .set("Cookie", `ecomm_auth=${token}`);

            expect(res.status).toBe(200);
            expect(res.body.cart.items).toEqual([]);
            expect(res.body.cart.itemCount).toBe(0);
        });

        it("returns 401 without auth", async () => {
            const res = await request(app).get("/cart");
            expect(res.status).toBe(401);
        });
    });

    describe("POST /cart/items", () => {
        it("adds an item to the cart", async () => {
            const { token } = await createTestUser();
            const product = await createTestProduct();

            const res = await addToCart(token, product.id, 2);

            expect(res.status).toBe(201);
            expect(res.body.cart.items).toHaveLength(1);
            expect(res.body.cart.items[0].quantity).toBe(2);
            expect(res.body.cart.items[0].productId).toBe(product.id);
            expect(res.body.cart.itemCount).toBe(2);
        });

        it("increments quantity on second add", async () => {
            const { token } = await createTestUser();
            const product = await createTestProduct();

            await addToCart(token, product.id, 2);
            const res = await addToCart(token, product.id, 3);

            expect(res.status).toBe(201);
            expect(res.body.cart.items).toHaveLength(1);
            expect(res.body.cart.items[0].quantity).toBe(5);
            expect(res.body.cart.itemCount).toBe(5);
        });

        it("clamps at available stock", async () => {
            const { token } = await createTestUser();
            const product = await createTestProduct({ physicalStock: 3 });

            const res = await addToCart(token, product.id, 5);

            expect(res.status).toBe(409);
            expect(res.body.error.code).toBe("INSUFFICIENT_STOCK");
        });

        it("requires auth", async () => {
            const product = await createTestProduct();

            const res = await request(app)
                .post("/cart/items")
                .set("X-Requested-With", "fetch")
                .send({ productId: product.id, quantity: 1 });

            expect(res.status).toBe(401);
        });
    });

    describe("PATCH /cart/items/:productId", () => {
        it("updates quantity", async () => {
            const { token } = await createTestUser();
            const product = await createTestProduct({ physicalStock: 50 });

            await addToCart(token, product.id, 2);
            const res = await request(app)
                .patch(`/cart/items/${product.id}`)
                .set("Cookie", `ecomm_auth=${token}`)
                .set("X-Requested-With", "fetch")
                .send({ quantity: 5 });

            expect(res.status).toBe(200);
            expect(res.body.cart.items[0].quantity).toBe(5);
        });

        it("removes item when quantity is 0", async () => {
            const { token } = await createTestUser();
            const product = await createTestProduct();

            await addToCart(token, product.id, 2);
            const res = await request(app)
                .patch(`/cart/items/${product.id}`)
                .set("Cookie", `ecomm_auth=${token}`)
                .set("X-Requested-With", "fetch")
                .send({ quantity: 0 });

            expect(res.status).toBe(200);
            expect(res.body.cart.items).toHaveLength(0);
            expect(res.body.cart.itemCount).toBe(0);
        });
    });

    describe("DELETE /cart/items/:productId", () => {
        it("removes an item", async () => {
            const { token } = await createTestUser();
            const product = await createTestProduct();

            await addToCart(token, product.id, 2);
            const res = await request(app)
                .delete(`/cart/items/${product.id}`)
                .set("Cookie", `ecomm_auth=${token}`)
                .set("X-Requested-With", "fetch");

            expect(res.status).toBe(200);
            expect(res.body.cart.items).toHaveLength(0);
        });
    });

    describe("DELETE /cart", () => {
        it("clears the cart", async () => {
            const { token } = await createTestUser();
            const p1 = await createTestProduct();
            const p2 = await createTestProduct();

            await addToCart(token, p1.id, 1);
            await addToCart(token, p2.id, 2);

            const res = await request(app)
                .delete("/cart")
                .set("Cookie", `ecomm_auth=${token}`)
                .set("X-Requested-With", "fetch");

            expect(res.status).toBe(200);
            expect(res.body.cart.items).toHaveLength(0);
            expect(res.body.cart.itemCount).toBe(0);
        });
    });
});
