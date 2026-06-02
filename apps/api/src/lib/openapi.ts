import {
    OpenAPIRegistry,
    OpenApiGeneratorV3
} from "@asteasolutions/zod-to-openapi";

import {
    z,
    signupSchema,
    signinSchema,
    changePasswordSchema,
    updateProfileSchema,
    addressInputSchema,
    categoryCreateSchema,
    categoryUpdateSchema,
    categoryListQuerySchema,
    productCreateSchema,
    productUpdateSchema,
    productListQuerySchema,
    cartAddItemSchema,
    cartUpdateItemSchema,
    orderCreateSchema,
    paymentIntentSchema,
    orderListQuerySchema,
    orderStatusUpdateSchema,
    deleteImageSchema,
} from "@repo/shared";

const registry = new OpenAPIRegistry();

// Reusable path-parameter schema for :id params
const pathIdSchema = z.object({ id: z.string().min(1) });

// ── Request schemas (registered under /components/schemas) ──

const refs = {
    SignupInput: registry.register("SignupInput", signupSchema),
    SigninInput: registry.register("SigninInput", signinSchema),
    ChangePasswordInput: registry.register(
        "ChangePasswordInput",
        changePasswordSchema,
    ),
    UpdateProfileInput: registry.register(
        "UpdateProfileInput",
        updateProfileSchema,
    ),
    AddressInput: registry.register("AddressInput", addressInputSchema),
    CategoryCreate: registry.register("CategoryCreate", categoryCreateSchema),
    CategoryUpdate: registry.register("CategoryUpdate", categoryUpdateSchema),
    CategoryListQuery: registry.register(
        "CategoryListQuery",
        categoryListQuerySchema,
    ),
    ProductCreate: registry.register("ProductCreate", productCreateSchema),
    ProductUpdate: registry.register("ProductUpdate", productUpdateSchema),
    ProductListQuery: registry.register(
        "ProductListQuery",
        productListQuerySchema,
    ),
    CartAddItem: registry.register("CartAddItem", cartAddItemSchema),
    CartUpdateItem: registry.register("CartUpdateItem", cartUpdateItemSchema),
    OrderCreate: registry.register("OrderCreate", orderCreateSchema),
    PaymentIntentRequest: registry.register(
        "PaymentIntentRequest",
        paymentIntentSchema,
    ),
    OrderListQuery: registry.register(
        "OrderListQuery",
        orderListQuerySchema,
    ),
    OrderStatusUpdate: registry.register(
        "OrderStatusUpdate",
        orderStatusUpdateSchema,
    ),
    DeleteImage: registry.register("DeleteImage", deleteImageSchema),
};

// ── Response component schemas ──────────────────────────────

registry.registerComponent("schemas", "UserResponse", {
    type: "object",
    properties: {
        id: { type: "string" },
        email: { type: "string" },
        name: { type: "string", nullable: true },
        role: { type: "string", enum: ["CUSTOMER", "ADMIN"] },
        tokenVersion: { type: "integer" },
    },
});

registry.registerComponent("schemas", "AuthResponse", {
    type: "object",
    properties: {
        user: { $ref: "#/components/schemas/UserResponse" },
    },
});

registry.registerComponent("schemas", "SigninResponse", {
    type: "object",
    properties: {
        user: { $ref: "#/components/schemas/UserResponse" },
    },
});

registry.registerComponent("schemas", "ChangePasswordResponse", {
    type: "object",
    properties: {
        user: { $ref: "#/components/schemas/UserResponse" },
        token: { type: "string", description: "New JWT (sets auth cookie)" },
    },
});

registry.registerComponent("schemas", "AddressResponse", {
    type: "object",
    properties: {
        id: { type: "string" },
        userId: { type: "string" },
        name: { type: "string", nullable: true },
        phone: { type: "string", nullable: true },
        line1: { type: "string" },
        line2: { type: "string", nullable: true },
        city: { type: "string" },
        state: { type: "string", nullable: true },
        postalCode: { type: "string" },
        country: { type: "string", nullable: true },
    },
});

registry.registerComponent("schemas", "CategoryResponse", {
    type: "object",
    properties: {
        id: { type: "string" },
        slug: { type: "string" },
        name: { type: "string" },
        parentId: { type: "string", nullable: true },
        isActive: { type: "boolean" },
        subcategories: {
            type: "array",
            items: { $ref: "#/components/schemas/CategoryResponse" },
        },
    },
});

registry.registerComponent("schemas", "ProductImageResponse", {
    type: "object",
    properties: {
        id: { type: "string" },
        url: { type: "string" },
        publicId: { type: "string" },
        alt: { type: "string", nullable: true },
        position: { type: "integer" },
    },
});

registry.registerComponent("schemas", "ProductResponse", {
    type: "object",
    properties: {
        id: { type: "string" },
        slug: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        priceMinor: { type: "string", description: "BigInt minor units" },
        currency: { type: "string" },
        stock: { type: "integer" },
        isActive: { type: "boolean" },
        categoryId: { type: "string" },
        images: {
            type: "array",
            items: { $ref: "#/components/schemas/ProductImageResponse" },
        },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
    },
});

registry.registerComponent("schemas", "CartItemResponse", {
    type: "object",
    properties: {
        productId: { type: "string" },
        name: { type: "string" },
        slug: { type: "string" },
        imageUrl: { type: "string", nullable: true },
        quantity: { type: "integer" },
        unitPriceMinor: { type: "string" },
        currency: { type: "string" },
        lineTotalMinor: { type: "string" },
        stock: { type: "integer" },
    },
});

registry.registerComponent("schemas", "CartResponse", {
    type: "object",
    properties: {
        id: { type: "string" },
        userId: { type: "string" },
        items: {
            type: "array",
            items: { $ref: "#/components/schemas/CartItemResponse" },
        },
    },
});

registry.registerComponent("schemas", "CartSummaryResponse", {
    type: "object",
    properties: {
        subtotalMinor: { type: "string" },
        shippingMinor: { type: "string" },
        taxMinor: { type: "string" },
        totalMinor: { type: "string" },
        currency: { type: "string" },
        itemCount: { type: "integer" },
    },
});

registry.registerComponent("schemas", "OrderItemResponse", {
    type: "object",
    properties: {
        id: { type: "string" },
        productId: { type: "string" },
        productName: { type: "string" },
        unitPriceMinor: { type: "string" },
        currency: { type: "string" },
        quantity: { type: "integer" },
    },
});

registry.registerComponent("schemas", "PaymentResponse", {
    type: "object",
    properties: {
        id: { type: "string" },
        providerPaymentId: { type: "string", nullable: true },
        status: {
            type: "string",
            enum: [
                "REQUIRES_PAYMENT",
                "SUCCEEDED",
                "FAILED",
                "REFUNDED",
            ],
        },
        amountMinor: { type: "string" },
        currency: { type: "string" },
        failureReason: { type: "string", nullable: true },
    },
});

registry.registerComponent("schemas", "OrderResponse", {
    type: "object",
    properties: {
        id: { type: "string" },
        userId: { type: "string" },
        status: {
            type: "string",
            enum: [
                "PENDING",
                "PAID",
                "PROCESSING",
                "SHIPPED",
                "DELIVERED",
                "CANCELLED",
                "FAILED",
                "REFUNDED",
            ],
        },
        subtotalMinor: { type: "string" },
        shippingMinor: { type: "string" },
        taxMinor: { type: "string" },
        totalMinor: { type: "string" },
        currency: { type: "string" },
        paidAt: { type: "string", format: "date-time", nullable: true },
        shippingName: { type: "string", nullable: true },
        shippingLine1: { type: "string", nullable: true },
        shippingLine2: { type: "string", nullable: true },
        shippingCity: { type: "string", nullable: true },
        shippingState: { type: "string", nullable: true },
        shippingPostalCode: { type: "string", nullable: true },
        shippingCountry: { type: "string", nullable: true },
        items: {
            type: "array",
            items: { $ref: "#/components/schemas/OrderItemResponse" },
        },
        payments: {
            type: "array",
            items: { $ref: "#/components/schemas/PaymentResponse" },
        },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
    },
});

registry.registerComponent("schemas", "CreateOrderResponse", {
    type: "object",
    properties: {
        order: { $ref: "#/components/schemas/OrderResponse" },
    },
});

registry.registerComponent("schemas", "PaymentIntentResponse", {
    type: "object",
    properties: {
        clientSecret: { type: "string" },
        order: { $ref: "#/components/schemas/OrderResponse" },
    },
});

registry.registerComponent("schemas", "ImageUploadResponse", {
    type: "object",
    properties: {
        url: { type: "string" },
        publicId: { type: "string" },
    },
});

registry.registerComponent("schemas", "ErrorResponse", {
    type: "object",
    properties: {
        code: { type: "string" },
        message: { type: "string" },
        details: {},
    },
});

// ── Security scheme ─────────────────────────────────────────

registry.registerComponent("securitySchemes", "cookieAuth", {
    type: "apiKey",
    in: "cookie",
    name: "ecomm_auth",
    description:
        "JWT stored in an httpOnly cookie. Set by signin/signup and sent automatically by the browser on same-origin requests.",
});

// ── Helper: common responses ────────────────────────────────

// biome-ignore lint/suspicious/noExplicitAny: inline schema objects are valid OpenAPI at runtime but the library's SchemaObject type expects strict literal unions
const inline = (s: Record<string, unknown>): any => s;

const ok = (schema: Record<string, unknown>) => ({
    description: "OK",
    content: { "application/json": { schema: inline(schema) } },
});

const created = (schema: Record<string, unknown>) => ({
    description: "Created",
    content: { "application/json": { schema: inline(schema) } },
});

const noContent = { description: "No content" };

const badRequest = {
    description: "Validation error",
    content: {
        "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
        },
    },
};

const unauthorized = {
    description: "Not authenticated",
    content: {
        "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
        },
    },
};

const forbidden = {
    description: "Not authorized (admin required)",
    content: {
        "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
        },
    },
};

const notFound = {
    description: "Resource not found",
    content: {
        "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
        },
    },
};

const conflict = {
    description: "Conflict (e.g. email already in use, insufficient stock)",
    content: {
        "application/json": {
            schema: { $ref: "#/components/schemas/ErrorResponse" },
        },
    },
};

const rateLimited = {
    description: "Too many requests",
} as const;

// ── Paths ───────────────────────────────────────────────────

// -- Health --------------------------------------------------

registry.registerPath({
    method: "get",
    path: "/health/live",
    summary: "Liveness probe (no dependencies)",
    tags: ["Health"],
    responses: {
        200: ok({ type: "object", properties: { status: { type: "string" } } }),
    },
});

registry.registerPath({
    method: "get",
    path: "/health/readyz",
    summary: "Readiness probe (DB + Redis required)",
    description:
        "Returns 200 when both Postgres and Redis are reachable. Use for orchestrator traffic-gating (e.g. Render health check, k8s readiness probe). Returns 503 if either dependency is down.",
    tags: ["Health"],
    responses: {
        200: ok({
            type: "object",
            properties: {
                status: { type: "string" },
                db: { type: "string" },
                redis: { type: "string" },
            },
        }),
        503: { description: "Database or Redis unreachable" },
    },
});

registry.registerPath({
    method: "get",
    path: "/health",
    summary: "Health check with DB + Redis ping",
    tags: ["Health"],
    responses: {
        200: ok({
            type: "object",
            properties: {
                status: { type: "string" },
                db: { type: "string" },
                redis: { type: "string" },
            },
        }),
        503: { description: "Database or Redis unreachable" },
    },
});

// -- Root ----------------------------------------------------

registry.registerPath({
    method: "get",
    path: "/",
    summary: "API root",
    tags: ["Health"],
    responses: {
        200: ok({
            type: "object",
            properties: { message: { type: "string" } },
        }),
    },
});

// -- Auth ----------------------------------------------------

registry.registerPath({
    method: "post",
    path: "/auth/signup",
    summary: "Create a new account",
    tags: ["Auth"],
    request: {
        body: {
            description: "New user credentials",
            content: {
                "application/json": { schema: refs.SignupInput },
            },
            required: true,
        },
    },
    responses: {
        201: created({ $ref: "#/components/schemas/AuthResponse" }),
        400: badRequest,
        409: conflict,
        429: rateLimited,
    },
});

registry.registerPath({
    method: "post",
    path: "/auth/signin",
    summary: "Sign in to an existing account",
    tags: ["Auth"],
    request: {
        body: {
            description: "Login credentials",
            content: {
                "application/json": { schema: refs.SigninInput },
            },
            required: true,
        },
    },
    responses: {
        200: ok({ $ref: "#/components/schemas/SigninResponse" }),
        400: badRequest,
        401: unauthorized,
        429: rateLimited,
    },
});

registry.registerPath({
    method: "post",
    path: "/auth/signout",
    summary: "Sign out (clears auth cookie)",
    tags: ["Auth"],
    responses: { 204: noContent },
});

registry.registerPath({
    method: "get",
    path: "/auth/me",
    summary: "Get current user profile",
    tags: ["Auth"],
    security: [{ cookieAuth: [] }],
    responses: {
        200: ok({ $ref: "#/components/schemas/UserResponse" }),
        401: unauthorized,
    },
});

registry.registerPath({
    method: "patch",
    path: "/auth/me",
    summary: "Update current user profile",
    tags: ["Auth"],
    security: [{ cookieAuth: [] }],
    request: {
        body: {
            content: {
                "application/json": { schema: refs.UpdateProfileInput },
            },
        },
    },
    responses: {
        200: ok({ $ref: "#/components/schemas/UserResponse" }),
        400: badRequest,
        401: unauthorized,
    },
});

registry.registerPath({
    method: "post",
    path: "/auth/change-password",
    summary: "Change password (invalidates all other sessions)",
    tags: ["Auth"],
    security: [{ cookieAuth: [] }],
    request: {
        body: {
            description: "Current and new password",
            content: {
                "application/json": { schema: refs.ChangePasswordInput },
            },
            required: true,
        },
    },
    responses: {
        200: ok({ $ref: "#/components/schemas/ChangePasswordResponse" }),
        400: badRequest,
        401: unauthorized,
        429: rateLimited,
    },
});

registry.registerPath({
    method: "post",
    path: "/auth/sign-out-all",
    summary: "Invalidate all sessions for the current user",
    tags: ["Auth"],
    security: [{ cookieAuth: [] }],
    responses: {
        204: noContent,
        401: unauthorized,
    },
});

// -- Addresses -----------------------------------------------

registry.registerPath({
    method: "get",
    path: "/addresses",
    summary: "List own addresses",
    tags: ["Addresses"],
    security: [{ cookieAuth: [] }],
    responses: {
        200: ok({
            type: "array",
            items: { $ref: "#/components/schemas/AddressResponse" },
        }),
        401: unauthorized,
    },
});

registry.registerPath({
    method: "post",
    path: "/addresses",
    summary: "Create a new address",
    tags: ["Addresses"],
    security: [{ cookieAuth: [] }],
    request: {
        body: {
            content: {
                "application/json": { schema: refs.AddressInput },
            },
            required: true,
        },
    },
    responses: {
        201: created({ $ref: "#/components/schemas/AddressResponse" }),
        400: badRequest,
        401: unauthorized,
    },
});

registry.registerPath({
    method: "put",
    path: "/addresses/{id}",
    summary: "Update an existing address",
    tags: ["Addresses"],
    security: [{ cookieAuth: [] }],
    request: {
        params: pathIdSchema,
        body: {
            content: {
                "application/json": { schema: refs.AddressInput },
            },
            required: true,
        },
    },
    responses: {
        200: ok({ $ref: "#/components/schemas/AddressResponse" }),
        400: badRequest,
        401: unauthorized,
        404: notFound,
    },
});

registry.registerPath({
    method: "delete",
    path: "/addresses/{id}",
    summary: "Delete an address",
    tags: ["Addresses"],
    security: [{ cookieAuth: [] }],
    responses: {
        204: noContent,
        401: unauthorized,
        404: notFound,
    },
});

// -- Categories ----------------------------------------------

registry.registerPath({
    method: "get",
    path: "/categories",
    summary: "List categories",
    tags: ["Categories"],
    request: {
        query: refs.CategoryListQuery,
    },
    responses: {
        200: ok({
            type: "array",
            items: { $ref: "#/components/schemas/CategoryResponse" },
        }),
    },
});

registry.registerPath({
    method: "get",
    path: "/categories/slug/{slug}",
    summary: "Get category by slug",
    tags: ["Categories"],
    responses: {
        200: ok({ $ref: "#/components/schemas/CategoryResponse" }),
        404: notFound,
    },
});

registry.registerPath({
    method: "get",
    path: "/categories/{id}",
    summary: "Get category by ID",
    tags: ["Categories"],
    responses: {
        200: ok({ $ref: "#/components/schemas/CategoryResponse" }),
        404: notFound,
    },
});

registry.registerPath({
    method: "post",
    path: "/categories",
    summary: "Create a category (admin)",
    tags: ["Categories"],
    security: [{ cookieAuth: [] }],
    request: {
        body: {
            content: {
                "application/json": { schema: refs.CategoryCreate },
            },
            required: true,
        },
    },
    responses: {
        201: created({ $ref: "#/components/schemas/CategoryResponse" }),
        400: badRequest,
        401: unauthorized,
        403: forbidden,
        409: conflict,
    },
});

registry.registerPath({
    method: "put",
    path: "/categories/{id}",
    summary: "Update a category (admin)",
    tags: ["Categories"],
    security: [{ cookieAuth: [] }],
    request: {
        body: {
            content: {
                "application/json": { schema: refs.CategoryUpdate },
            },
            required: true,
        },
    },
    responses: {
        200: ok({ $ref: "#/components/schemas/CategoryResponse" }),
        400: badRequest,
        401: unauthorized,
        403: forbidden,
        404: notFound,
    },
});

registry.registerPath({
    method: "delete",
    path: "/categories/{id}",
    summary: "Delete a category (admin)",
    tags: ["Categories"],
    security: [{ cookieAuth: [] }],
    responses: {
        204: noContent,
        401: unauthorized,
        403: forbidden,
        404: notFound,
        409: conflict,
    },
});

// -- Products ------------------------------------------------

registry.registerPath({
    method: "get",
    path: "/products",
    summary: "List products (paginated, filterable)",
    tags: ["Products"],
    request: {
        query: refs.ProductListQuery,
    },
    responses: {
        200: ok({
            type: "object",
            properties: {
                data: {
                    type: "array",
                    items: { $ref: "#/components/schemas/ProductResponse" },
                },
                cursor: { type: "string", nullable: true },
            },
        }),
    },
});

registry.registerPath({
    method: "get",
    path: "/products/slug/{slug}",
    summary: "Get product by slug",
    tags: ["Products"],
    responses: {
        200: ok({ $ref: "#/components/schemas/ProductResponse" }),
        404: notFound,
    },
});

registry.registerPath({
    method: "get",
    path: "/products/{id}",
    summary: "Get product by ID (active only for public)",
    tags: ["Products"],
    responses: {
        200: ok({ $ref: "#/components/schemas/ProductResponse" }),
        404: notFound,
    },
});

registry.registerPath({
    method: "post",
    path: "/products",
    summary: "Create a product (admin)",
    tags: ["Products"],
    security: [{ cookieAuth: [] }],
    request: {
        body: {
            content: {
                "application/json": { schema: refs.ProductCreate },
            },
            required: true,
        },
    },
    responses: {
        201: created({ $ref: "#/components/schemas/ProductResponse" }),
        400: badRequest,
        401: unauthorized,
        403: forbidden,
    },
});

registry.registerPath({
    method: "put",
    path: "/products/{id}",
    summary: "Update a product (admin)",
    tags: ["Products"],
    security: [{ cookieAuth: [] }],
    request: {
        body: {
            content: {
                "application/json": { schema: refs.ProductUpdate },
            },
            required: true,
        },
    },
    responses: {
        200: ok({ $ref: "#/components/schemas/ProductResponse" }),
        400: badRequest,
        401: unauthorized,
        403: forbidden,
        404: notFound,
    },
});

registry.registerPath({
    method: "delete",
    path: "/products/{id}",
    summary: "Delete a product (admin)",
    tags: ["Products"],
    security: [{ cookieAuth: [] }],
    responses: {
        204: noContent,
        401: unauthorized,
        403: forbidden,
        404: notFound,
        409: conflict,
    },
});

// -- Images --------------------------------------------------

registry.registerPath({
    method: "post",
    path: "/images/upload",
    summary: "Upload an image to Cloudinary (admin)",
    description:
        "Accepts multipart/form-data with a single `file` field. Returns the Cloudinary URL and public ID.",
    tags: ["Images"],
    security: [{ cookieAuth: [] }],
    request: {
        body: {
            description: "Image file (multipart/form-data)",
            content: {
                "multipart/form-data": {
                    schema: {
                        type: "object",
                        properties: {
                            file: {
                                type: "string",
                                format: "binary",
                            },
                        },
                        required: ["file"],
                    },
                },
            },
        },
    },
    responses: {
        200: ok({ $ref: "#/components/schemas/ImageUploadResponse" }),
        400: badRequest,
        401: unauthorized,
        403: forbidden,
    },
});

registry.registerPath({
    method: "delete",
    path: "/images",
    summary: "Delete an image from Cloudinary (admin)",
    tags: ["Images"],
    security: [{ cookieAuth: [] }],
    request: {
        body: {
            content: {
                "application/json": { schema: refs.DeleteImage },
            },
            required: true,
        },
    },
    responses: {
        204: noContent,
        400: badRequest,
        401: unauthorized,
        403: forbidden,
    },
});

// -- Cart ----------------------------------------------------

registry.registerPath({
    method: "get",
    path: "/cart",
    summary: "Get current user's cart",
    tags: ["Cart"],
    security: [{ cookieAuth: [] }],
    responses: {
        200: ok({ $ref: "#/components/schemas/CartResponse" }),
        401: unauthorized,
    },
});

registry.registerPath({
    method: "post",
    path: "/cart/items",
    summary: "Add an item to the cart",
    tags: ["Cart"],
    security: [{ cookieAuth: [] }],
    request: {
        body: {
            content: {
                "application/json": { schema: refs.CartAddItem },
            },
            required: true,
        },
    },
    responses: {
        201: created({ $ref: "#/components/schemas/CartResponse" }),
        400: badRequest,
        401: unauthorized,
        404: notFound,
        409: conflict,
    },
});

registry.registerPath({
    method: "patch",
    path: "/cart/items/{productId}",
    summary: "Update cart item quantity (0 = remove)",
    tags: ["Cart"],
    security: [{ cookieAuth: [] }],
    request: {
        body: {
            content: {
                "application/json": { schema: refs.CartUpdateItem },
            },
            required: true,
        },
    },
    responses: {
        200: ok({ $ref: "#/components/schemas/CartResponse" }),
        400: badRequest,
        401: unauthorized,
        404: notFound,
        409: conflict,
    },
});

registry.registerPath({
    method: "delete",
    path: "/cart/items/{productId}",
    summary: "Remove an item from the cart",
    tags: ["Cart"],
    security: [{ cookieAuth: [] }],
    responses: {
        200: ok({ $ref: "#/components/schemas/CartResponse" }),
        401: unauthorized,
        404: notFound,
    },
});

registry.registerPath({
    method: "delete",
    path: "/cart",
    summary: "Clear the entire cart",
    tags: ["Cart"],
    security: [{ cookieAuth: [] }],
    responses: {
        200: ok({ $ref: "#/components/schemas/CartResponse" }),
        401: unauthorized,
    },
});

registry.registerPath({
    method: "post",
    path: "/cart/summary",
    summary: "Get pricing breakdown for the cart",
    tags: ["Cart"],
    security: [{ cookieAuth: [] }],
    responses: {
        200: ok({ $ref: "#/components/schemas/CartSummaryResponse" }),
        401: unauthorized,
    },
});

// -- Orders --------------------------------------------------

registry.registerPath({
    method: "get",
    path: "/orders",
    summary: "List orders (own orders; admins can query ?scope=all)",
    tags: ["Orders"],
    security: [{ cookieAuth: [] }],
    request: {
        query: refs.OrderListQuery,
    },
    responses: {
        200: ok({
            type: "object",
            properties: {
                data: {
                    type: "array",
                    items: { $ref: "#/components/schemas/OrderResponse" },
                },
                cursor: { type: "string", nullable: true },
            },
        }),
        401: unauthorized,
    },
});

registry.registerPath({
    method: "post",
    path: "/orders",
    summary: "Create an order from the cart (idempotent)",
    description:
        "Creates a PENDING order, deducts stock, clears the cart. Accepts Idempotency-Key header for safe retries.",
    tags: ["Orders"],
    security: [{ cookieAuth: [] }],
    request: {
        body: {
            content: {
                "application/json": { schema: refs.OrderCreate },
            },
            required: true,
        },
    },
    parameters: [
        {
            name: "Idempotency-Key",
            in: "header",
            required: false,
            schema: { type: "string" },
            description: "Idempotency key for safe retries (24h replay cache)",
        },
    ],
    responses: {
        201: created({ $ref: "#/components/schemas/CreateOrderResponse" }),
        400: badRequest,
        401: unauthorized,
        409: conflict,
        429: rateLimited,
    },
});

registry.registerPath({
    method: "get",
    path: "/orders/{id}",
    summary: "Get order details",
    tags: ["Orders"],
    security: [{ cookieAuth: [] }],
    responses: {
        200: ok({ $ref: "#/components/schemas/OrderResponse" }),
        401: unauthorized,
        403: forbidden,
        404: notFound,
    },
});

registry.registerPath({
    method: "post",
    path: "/orders/{id}/cancel",
    summary: "Cancel a PENDING order (restores stock)",
    tags: ["Orders"],
    security: [{ cookieAuth: [] }],
    responses: {
        200: ok({ $ref: "#/components/schemas/OrderResponse" }),
        401: unauthorized,
        403: forbidden,
        404: notFound,
        409: conflict,
    },
});

registry.registerPath({
    method: "patch",
    path: "/orders/{id}/status",
    summary: "Update order status (admin only)",
    tags: ["Orders"],
    security: [{ cookieAuth: [] }],
    request: {
        body: {
            content: {
                "application/json": { schema: refs.OrderStatusUpdate },
            },
            required: true,
        },
    },
    responses: {
        200: ok({ $ref: "#/components/schemas/OrderResponse" }),
        400: badRequest,
        401: unauthorized,
        403: forbidden,
        404: notFound,
        409: conflict,
    },
});

registry.registerPath({
    method: "post",
    path: "/orders/{id}/refund",
    summary: "Refund an order via Stripe (admin only)",
    tags: ["Orders"],
    security: [{ cookieAuth: [] }],
    responses: {
        202: {
            description: "Refund initiated",
            content: {
                "application/json": {
                    schema: {
                        type: "object",
                        properties: {
                            refundId: { type: "string" },
                        },
                    },
                },
            },
        },
        401: unauthorized,
        403: forbidden,
        404: notFound,
        409: conflict,
    },
});

// -- Payments ------------------------------------------------

registry.registerPath({
    method: "post",
    path: "/payments/intent",
    summary: "Create a Stripe PaymentIntent for an order (idempotent)",
    description:
        "Creates a Stripe PaymentIntent for a PENDING order. Accepts Idempotency-Key header.",
    tags: ["Payments"],
    security: [{ cookieAuth: [] }],
    parameters: [
        {
            name: "Idempotency-Key",
            in: "header",
            required: false,
            schema: { type: "string" },
            description: "Idempotency key for safe retries (24h replay cache)",
        },
    ],
    request: {
        body: {
            content: {
                "application/json": { schema: refs.PaymentIntentRequest },
            },
            required: true,
        },
    },
    responses: {
        200: ok({ $ref: "#/components/schemas/PaymentIntentResponse" }),
        400: badRequest,
        401: unauthorized,
        404: notFound,
        409: conflict,
        429: rateLimited,
    },
});

registry.registerPath({
    method: "post",
    path: "/payments/webhook",
    summary: "Stripe webhook receiver (raw body, no auth)",
    description:
        "Receives Stripe webhook events. Body is verified against STRIPE_WEBHOOK_SECRET. Events are deduplicated via WebhookEvent table.",
    tags: ["Payments"],
    request: {
        body: {
            description: "Raw JSON body (Stripe signature in header)",
            content: {
                "application/json": {
                    schema: { type: "object" },
                },
            },
        },
    },
    responses: {
        200: ok({ type: "object", properties: { received: { type: "boolean" } } }),
        400: badRequest,
    },
});

// -- Admin Webhooks ------------------------------------------

registry.registerPath({
    method: "post",
    path: "/admin/webhooks/{id}/retry",
    summary: "Retry a failed webhook event",
    description:
        "Manually retries a webhook event that failed to process. Enqueues a retry job in the webhooks-retry BullMQ queue.",
    tags: ["Admin"],
    security: [{ cookieAuth: [] }],
    request: {
        params: pathIdSchema,
    },
    responses: {
        200: ok({
            type: "object",
            properties: { webhookEventId: { type: "string" } },
        }),
        401: unauthorized,
        403: forbidden,
        404: notFound,
        409: conflict,
    },
});

// ── Generate Document ───────────────────────────────────────

export const openApiDoc = new OpenApiGeneratorV3(
    registry.definitions,
).generateDocument({
    openapi: "3.0.3",
    info: {
        title: "KartIt API",
        version: "1.0.0",
        description:
            "Backend API for the KartIt platform — products, cart, orders, and Stripe payments.\n\n" +
            "**Auth:** JWT in an httpOnly cookie (`ecomm_auth`). Set by signin/signup.\n\n" +
            "**CSRF protection:** State-changing requests require an `X-Requested-With: fetch` header.\n\n" +
            "**Idempotency:** `POST /orders` and `POST /payments/intent` accept an `Idempotency-Key` header for safe retries.",
    },
    servers: [
        { url: "http://localhost:5000", description: "Local dev" },
    ],
    tags: [
        { name: "Health", description: "Liveness and readiness probes" },
        {
            name: "Auth",
            description: "Signup, signin, profile, and session management",
        },
        { name: "Addresses", description: "User shipping addresses" },
        { name: "Categories", description: "Product categories" },
        { name: "Products", description: "Product catalog" },
        { name: "Images", description: "Cloudinary image uploads (admin)" },
        { name: "Cart", description: "Shopping cart CRUD" },
        { name: "Orders", description: "Order lifecycle and payments" },
        {
            name: "Payments",
            description: "Stripe PaymentIntents and webhooks",
        },
    ],
});
