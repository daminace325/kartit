import { describe, it, expect, beforeEach } from "vitest";
import { makeApp, request, cleanDb, createTestUser } from "../helpers";

let app = makeApp();

describe("POST /auth/signup", () => {
    beforeEach(async () => {
        await cleanDb();
        app = makeApp();
    });

    it("creates a new user and returns 201 with user + set-cookie", async () => {
        const res = await request(app)
            .post("/auth/signup")
            .set("X-Requested-With", "fetch")
            .send({ email: "new@example.com", password: "password123", name: "New" });

        expect(res.status).toBe(201);
        expect(res.body.user).toMatchObject({
            email: "new@example.com",
            name: "New",
            role: "CUSTOMER",
        });
        expect(res.headers["set-cookie"]).toBeDefined();
    });

    it("returns 409 for duplicate email", async () => {
        await createTestUser({ email: "dup@example.com" });

        const res = await request(app)
            .post("/auth/signup")
            .set("X-Requested-With", "fetch")
            .send({ email: "dup@example.com", password: "password123" });

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe("EMAIL_IN_USE");
    });

    it("returns 400 for short password", async () => {
        const res = await request(app)
            .post("/auth/signup")
            .set("X-Requested-With", "fetch")
            .send({ email: "new@example.com", password: "123" });

        expect(res.status).toBe(400);
    });
});

describe("POST /auth/signin", () => {
    beforeEach(async () => {
        await cleanDb();
        app = makeApp();
    });

    it("signs in with correct credentials", async () => {
        await createTestUser({ email: "signin@example.com", password: "mypassword" });

        const res = await request(app)
            .post("/auth/signin")
            .set("X-Requested-With", "fetch")
            .send({ email: "signin@example.com", password: "mypassword" });

        expect(res.status).toBe(200);
        expect(res.body.user.email).toBe("signin@example.com");
        expect(res.headers["set-cookie"]).toBeDefined();
    });

    it("returns 401 for wrong password", async () => {
        await createTestUser({ email: "signin@example.com", password: "mypassword" });

        const res = await request(app)
            .post("/auth/signin")
            .set("X-Requested-With", "fetch")
            .send({ email: "signin@example.com", password: "wrongpass" });

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("returns 401 for unknown email", async () => {
        const res = await request(app)
            .post("/auth/signin")
            .set("X-Requested-With", "fetch")
            .send({ email: "nobody@example.com", password: "password123" });

        expect(res.status).toBe(401);
    });
});

describe("GET /auth/me", () => {
    beforeEach(async () => {
        await cleanDb();
        app = makeApp();
    });

    it("returns current user when authenticated", async () => {
        const { token } = await createTestUser();

        const res = await request(app)
            .get("/auth/me")
            .set("Cookie", `ecomm_auth=${token}`);

        expect(res.status).toBe(200);
        expect(res.body.user.email).toBe("test@example.com");
    });

    it("returns 401 without cookie", async () => {
        const res = await request(app).get("/auth/me");
        expect(res.status).toBe(401);
    });
});

describe("POST /auth/change-password", () => {
    beforeEach(async () => {
        await cleanDb();
        app = makeApp();
    });

    it("changes password and returns new token", async () => {
        const { token } = await createTestUser();

        const res = await request(app)
            .post("/auth/change-password")
            .set("Cookie", `ecomm_auth=${token}`)
            .set("X-Requested-With", "fetch")
            .send({ currentPassword: "password123", newPassword: "newpass456" });

        expect(res.status).toBe(200);
        expect(res.body.user).toBeDefined();
        expect(res.headers["set-cookie"]).toBeDefined();

        // Old token should be invalid (tokenVersion bumped)
        const oldRes = await request(app)
            .get("/auth/me")
            .set("Cookie", `ecomm_auth=${token}`);
        expect(oldRes.status).toBe(401);
    });

    it("returns 401 for wrong current password", async () => {
        const { token } = await createTestUser();

        const res = await request(app)
            .post("/auth/change-password")
            .set("Cookie", `ecomm_auth=${token}`)
            .set("X-Requested-With", "fetch")
            .send({ currentPassword: "wrongcurrent", newPassword: "newpass456" });

        expect(res.status).toBe(401);
    });
});

describe("POST /auth/sign-out-all", () => {
    beforeEach(async () => {
        await cleanDb();
        app = makeApp();
    });

    it("invalidates all sessions and clears cookie", async () => {
        const { token } = await createTestUser();

        const res = await request(app)
            .post("/auth/sign-out-all")
            .set("Cookie", `ecomm_auth=${token}`)
            .set("X-Requested-With", "fetch");

        expect(res.status).toBe(204);

        // Old token should be rejected
        const meRes = await request(app)
            .get("/auth/me")
            .set("Cookie", `ecomm_auth=${token}`);
        expect(meRes.status).toBe(401);
    });
});
