# ecomm Project Handoff

> Working context for the ecomm monorepo. Read this first when continuing work in a new chat.

## Goal

Build a production-grade ecomm app for resume → target **Rippling SE I (FinTech)**.

## Stack

- **Monorepo:** npm workspaces
- **Web:** `apps/web` — Next.js 16 + React 19 + Tailwind v4 (App Router)
- **API:** `apps/api` — Express 5 + TypeScript + ts-node-dev, hardened with `helmet` + `express-rate-limit`
- **DB package:** `packages/db` — Prisma 7 + `@prisma/adapter-pg` (Postgres adapter), seed script
- **Shared package:** `packages/shared` — zod schemas, money helpers, enums, error codes, pricing, cloudinary URL helper
- **DB:** Postgres 16 in Docker (`docker-compose.yml` at monorepo root)
- **Payments:** Stripe (PaymentIntents + webhook with raw-body verification)
- **Images:** Cloudinary server-side multer upload today (`POST /images/upload`); signed direct-from-browser upload is still the hardening target
- **Deploy:** [render.yaml](render.yaml) Blueprint (managed Postgres + API web service); web deploys separately
- **Path:** `c:\Projects\NextJS\ecomm-project\ecomm`
- **Reference:** `ecomm-reference/` is the old Next.js-only CRUD version, used only for reference

## Phase plan

- **Foundation (P0)** = working end-to-end app with Stripe, no advanced infra ✅ **COMPLETE**
- **Phase 1 — Gap fixing & hardening** = correctness/money-safety bugs, missing ecomm domain pieces, tests + CI, repo polish. Brings the existing surface to "would not embarrass me in a code review".
- **Phase 2 — Production-grade infra** = Redis, BullMQ + Outbox, double-entry ledger, Stripe reconciliation, observability, risk engine, refresh-token rotation, OpenTelemetry, k6 load. Earns the resume bullets.

## Foundation (P0) — sub-phases (all ✅ done)

| # | Title |
|---|---|
| 0.1 | Monorepo, Postgres docker, Prisma migrations, `/health` |
| 0.2 | Shared package: money, enums, errors, zod schemas, pricing |
| 0.3 | Auth: argon2, JWT in httpOnly cookie, requireAuth/requireAdmin, /auth/* |
| 0.4 | Catalog read-only: `ProductImage` model, seed, public `GET /products`, `/products/:slug`, `/categories` |
| 0.5 | Catalog admin write + Cloudinary image uploads (`/images/upload` today; `/images/sign` target) |
| 0.6 | Cart (`/cart` CRUD, badge, controls) |
| 0.7 | Orders (create from cart, list, detail, cancel, admin status transitions) |
| 0.8 | Stripe payment + webhook (raw-body verified at `/payments/webhook`) |
| 0.9 | Web UI for full flow (catalog, search, product detail, cart, checkout, orders, profile, addresses, admin) |
| 0.10 | Wrap-up (Render Blueprint, helmet, rate-limit, README/AGENTS docs) |

**Foundation is feature-complete and deployable.** Next work is Phase 1 hardening, then Phase 2 infra.

## User preferences (follow strictly)

- **4-space indentation** — enforced by [.editorconfig](.editorconfig) at root
- **Named exports per handler**, NO wrapping objects (e.g. `export const checkHealth: RequestHandler = ...`)
- Use `req`, not `_req` (except where genuinely unused, e.g. health liveness)
- **Module structure:** `modules/<feature>/<feature>.{routes,controller,service}.ts` (Option B feature-modules)
- **Stick with Express** (not Nest/Fastify)
- **Cloudinary:** current code uses server-side multer upload (`/images/upload`); Phase 1 should either keep and document that or switch to signed direct-from-browser uploads (`/images/sign`). Max 6 images per product; transformations done at render time via URL params (no eager transforms)
- **`ProductImage` as separate model** with array
- **`.env.example` files exist at root, `apps/api/`, and `apps/web/`** — each documents its own required env vars
- **No markdown docs unless asked**
- **Phase boundaries:** P1 may add small support tables/fields (`IdempotencyKey`, `WebhookEvent`, `Order` address snapshot fields, `tokenVersion`) when they're needed by a fix. The big infra tables (`Outbox`, `LedgerEntry`, `RefreshToken` family, `Reservation`) and the `apps/worker` service land in P2.
- **Step-by-step**, verify each step before moving on

## Current Prisma schema (Foundation)

Models:

- **`User`** — id, email (unique), passwordHash, name?, role (`CUSTOMER`|`ADMIN`), tokenVersion (`Int @default(0)`)
- **`Address`** — userId, line1, line2?, city, state?, postalCode, country?
- **`Category`** — slug (unique), name, parentId? (self-relation `CategoryToSubcategory`, `onDelete: SetNull`)
- **`Product`** — slug (unique), name, description, priceMinor (`BigInt`), currency (`Char(3)`), stock, isActive, categoryId
- **`ProductImage`** — productId (cascade), url, publicId, alt?, position, `@@unique([productId, position])`
- **`Cart`** — userId (unique, cascade)
- **`CartItem`** — cartId+productId unique, quantity
- **`Order`** — userId, status, subtotalMinor, shippingMinor, taxMinor, totalMinor, currency, paidAt?, items, payments
- **`OrderItem`** — snapshots productName + unitPriceMinor + currency at purchase time
- **`Payment`** — orderId (cascade), providerPaymentId? (unique — Stripe PaymentIntent id), status, amountMinor, currency, failureReason?
- **`IdempotencyKey`** — userId+key unique, requestHash, status, cached response, expiresAt *(P1.1 partially implemented)*

Enums:

- **`UserRole`** — `CUSTOMER`, `ADMIN`
- **`OrderStatus`** — `PENDING`, `PAID`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED`, `FAILED`, `REFUNDED` *(expanded from the original 5 to support fulfillment lifecycle in 1.7)*
- **`PaymentStatus`** — `REQUIRES_PAYMENT`, `SUCCEEDED`, `FAILED`, `REFUNDED`

Money everywhere as `BigInt` minor units, currency `Char(3)`. Never floats.

**Migrations applied:**
- `20260503073006_init` — initial schema (User, Address, Category, Product, ProductImage, Cart, CartItem, Order, OrderItem, Payment)
- `20260509142344_idempotency` — IdempotencyKey table
- `20260510065250_order_address_snapshot` — Order shipping fields (name, phone, line1, line2, city, state, postalCode, country) + Address name/phone
- `20260510071212_webhook_event_dedupe` — WebhookEvent table
- `20260512000000_session_invalidation` — User.tokenVersion
- `20260514174237_citext_email_case_folding` — citext extension + email type change

## File structure

```
ecomm/
  .editorconfig                  ← 4-space, lf
  .env / .env.example            ← POSTGRES_*, DATABASE_URL
  docker-compose.yml             ← Postgres only
  render.yaml                    ← Render Blueprint (managed pg + ecomm-api)
  package.json                   ← workspaces; dev / build / db:* / typecheck scripts
  tsconfig.base.json             ← @repo/shared, @repo/db path aliases
  context/
    HANDOFF.md                   ← (this file)
  apps/
    api/
      .env                       ← PORT, DATABASE_URL, JWT_*, COOKIE_*, WEB_ORIGINS,
                                   CLOUDINARY_*, STRIPE_*
      src/
        config/env.ts            ← validated env loader (prod-required keys, JWT length,
                                   SameSite=none ⇒ Secure check, multi-origin CORS)
        lib/
          asyncHandler.ts        ← async request handler wrapper (try/catch → next(err))
          cache.ts               ← TtlCache (in-process LRU for requireAuth hot path)
          cloudinary.ts          ← uploadBufferToCloudinary + destroyByPublicIds
          cookies.ts             ← setAuthCookie / clearAuthCookie (httpOnly)
          errors.ts              ← AppError class with static factories
          jwt.ts                 ← signToken / verifyToken (HS256, embeds tokenVersion)
          logger.ts              ← thin logger.info/.warn/.error (console wrapper; P2 → pino)
          password.ts            ← argon2id hash/verify
          stripe.ts              ← Stripe SDK singleton (pinned API version)
        middlewares/
          errorHandler.ts        ← errorHandler + notFoundHandler
          validate.ts            ← zod request validator (ZodType, Zod v4)
          requireAuth.ts         ← requireAuth + requireAdmin (extends Express.Request.user)
          csrf.ts                ← X-Requested-With: fetch check on mutating requests
          idempotency.ts         ← Idempotency-Key header middleware (24h replay cache)
          upload.ts              ← multer setup for any direct-upload endpoints
        modules/
          health/                ← /health (DB ping) + /health/live (no DB; Render probe)
          auth/                  ← auth.{controller,service,routes}.ts; /auth/signup, /signin, /signout, /sign-out-all, /me, /change-password, profile
          addresses/             ← addresses.{controller,service,routes}.ts; /addresses CRUD
          categories/            ← public GET + admin CRUD
          products/              ← public GET + admin CRUD
          images/                ← POST /images/upload + DELETE /images
          cart/                  ← /cart GET, add, update, remove, clear, summary
          orders/                ← /orders create, list, detail, cancel; admin status transitions + refund
                                    orders.{routes,controller,service}.ts +
                                    orders.payment.service.ts + orders.status.service.ts
          payments/              ← /payments/webhook (raw body), /payments/intent (create PI for order)
        app.ts                   ← createApp(): trust-proxy, helmet, multi-origin CORS,
                                   /payments mounted BEFORE express.json() (raw webhook),
                                   auth rate-limit, all routers
        server.ts                ← env.PORT, graceful shutdown on SIGINT/SIGTERM
    web/
      .env.local                 ← NEXT_PUBLIC_API_URL=http://localhost:5000
      .env.example               ← template with NEXT_PUBLIC_* vars documented
      AGENTS.md / CLAUDE.md / README.md
      app/
        layout.tsx, error.tsx, global-error.tsx, not-found.tsx, globals.css
        (auth)/                  ← signin, signup
        (public)/
          page.tsx               ← home (product grid)
          c/[slug]/              ← category pages
          p/[slug]/              ← product detail
          search/                ← search results
          cart/                  ← cart page
          checkout/              ← checkout (uses CheckoutClient)
          orders/                ← order list + detail + cancel + pay (deferred payment for PENDING orders)
          account/               ← account hub
          profile/               ← edit profile, change password, addresses
        admin/
          layout.tsx, page.tsx
          products/              ← list, new, [id] edit, ProductForm, DeleteProductButton
          categories/            ← list, new, [id] edit, CategoryForm, DeleteCategoryButton
          orders/                ← list, [id] detail with status transitions
      components/                ← Navbar, ProductCard, ProductGallery, AddToCart,
                                   CartBadge, CartItemControls, ClearCartButton,
                                   CheckoutClient, AddressesManager, EditProfileForm,
                                   ChangePasswordForm, SignOutButton, AdminSidebar,
                                   OrderStatusControls, CancelOrderButton,
                                   ErrorBanner, DeleteButton
      components/payment/        ← PayForm (Stripe PaymentElement + idempotency key cleanup)
      lib/                       ← auth.ts, dates.ts, formatApiError.ts, image.ts, slugify.ts
      hooks/                     ← useApiMutation.ts, useIdempotencyKey.ts, useStripeCheckout.ts
      services/                  ← apiClient.ts, checkout.ts
      constants/                 ← order-status.ts (status labels, styles, timeline)
  packages/
    db/
      .env                       ← DATABASE_URL (for Prisma CLI)
      prisma.config.ts           ← Prisma 7 config (datasource url here, NOT in schema)
      prisma/
        schema.prisma            ← models above
        migrations/20260503073006_init/   ← single consolidated initial migration
      src/
        index.ts                 ← prisma singleton with PrismaPg adapter
        seed.ts                  ← admin user + categories + products w/ images
    shared/
      src/
        index.ts                 ← barrel re-exporting everything below (including z)
        lib/
          zod.ts                 ← central patched zod — calls extendZodWithOpenApi(z) then re-exports z.
                                   ALL schema files import from here, not from "zod" directly.
        money.ts                 ← formatMoney, minorToMajor, majorToMinor, parseMoney, decimalsFor
        enums.ts                 ← UserRole, OrderStatus, PaymentStatus (string unions)
        errorCodes.ts            ← ErrorCode const object (VALIDATION_FAILED, UNAUTHORIZED, etc.)
        apiError.ts              ← ApiError type (code, message, details?)
        pricing.ts               ← calculatePricing (subtotal / shipping / tax / total helpers)
        cloudinary.ts            ← cloudinaryUrl(publicId, preset) render-time helper
        order-transitions.ts     ← VALID_STATUS_TRANSITIONS + getNextStatuses()
        schemas/
          auth.ts                ← signup, signin, changePassword, profile, address (imports z from ../lib/zod)
          category.ts            ← categoryCreate, categoryUpdate, categoryListQuery
          product.ts             ← productCreate, productUpdate, listQuery, ProductDTO, ProductImageDTO (max 6)
          cart.ts                ← cartAddItem, cartUpdateItem, CartDTO, CartItemDTO, CartSummaryDTO
          order.ts               ← orderCreate, paymentIntent, OrderDTO, CreateOrderResponse,
                                   PaymentIntentResponse, admin status-transition schemas
          image.ts               ← deleteImageSchema
```

## Env files (real values, not committed)

- `ecomm/.env` — `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL` (compose + Prisma CLI)
- `ecomm/.env.example` — template for the above
- `ecomm/apps/api/.env` — `PORT=5000`, `DATABASE_URL`, `JWT_SECRET` (≥32 chars), `JWT_EXPIRES_IN=7d`, `COOKIE_NAME=ecomm_auth`, `COOKIE_SECURE`, `COOKIE_SAMESITE` (`lax`/`strict`/`none`; `none` requires Secure), `WEB_ORIGINS` (comma-separated; supports single-`*` host wildcards like `https://*.vercel.app`), `CLOUDINARY_CLOUD_NAME`/`API_KEY`/`API_SECRET`/`FOLDER`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CURRENCY=USD`
- `ecomm/apps/api/.env.example` — template for the above
- `ecomm/apps/web/.env.local` — `NEXT_PUBLIC_API_URL=http://localhost:5000`, `NEXT_PUBLIC_AUTH_COOKIE_NAME=ecomm_auth`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- `ecomm/apps/web/.env.example` — template for the above
- `ecomm/packages/db/.env` — `DATABASE_URL` (separate, for Prisma CLI)

## Key gotchas / decisions

- **Prisma 7:** `url` lives in `prisma.config.ts`, NOT `schema.prisma`. Runtime requires `PrismaPg` adapter (`@prisma/adapter-pg` + `pg`).
- **Zod v4:** `ZodSchema` is deprecated → use `ZodType`. Must call `extendZodWithOpenApi(z)` before creating schemas. Done once in `packages/shared/src/lib/zod.ts` — every schema file imports `z` from `../lib/zod`, NEVER from `"zod"` directly. New schemas must follow this pattern.
- **Web cannot import from `apps/api`** — only from `@repo/shared`. `@repo/db` is server-only.
- **Refresh tokens deferred to P2** — single JWT in httpOnly cookie, 7d expiry.
- **Stripe webhook MUST be mounted BEFORE `express.json()`** in [app.ts](apps/api/src/app.ts) so signature verification sees the raw body. Router-local `express.raw()` parses it. The `/payments/intent` route in the same router supplies its own `express.json()` + `cookieParser()` since the global ones haven't run yet.
- **Checkout is now two-step:** `POST /orders` creates the PENDING order (reserves stock); `POST /payments/intent` creates the Stripe PaymentIntent. Both accept `Idempotency-Key` (frontend uses `${base}:order` and `${base}:intent`).
- **CORS:** `WEB_ORIGINS` (plural) is the env var. Each entry is exact origin or single-`*`-host wildcard. Compiled into matchers once at boot.
- **`trust proxy: 1`** is set so Render's LB gives correct `req.secure` / `req.ip` and the `Secure` cookie attribute behaves.
- **Auth rate-limit:** 30 req / 15 min on `/auth/signin` + `/auth/signup` (`express-rate-limit`, draft-7 headers).
- **P1 schema progress:** `IdempotencyKey`, `WebhookEvent`, order address snapshot fields, `User.tokenVersion` — all implemented. P2-only: `Outbox`, `LedgerEntry`, `RefreshToken` rotation family, `Reservation`.
- **Repo polish gotcha:** `.gitignore` currently ignores `.editorconfig`. `context/` is commented out in `.gitignore` (committed). If this repo is going to GitHub for resume review, stop ignoring `.editorconfig`.
- **Migration command:** `npm run db:migrate:dev -- --name <name>` from root (or directly in `packages/db`).
- **`migrate dev` auto-runs `generate`** — don't run generate separately unless after a fresh `npm install`.
- **Render deploy:** start command runs `db:migrate:deploy && db:seed && start:api`. Seed must be idempotent.
- **Health probes:** `/health/live` (no DB — Render uses this) vs `/health` (DB ping — manual/monitoring).

## Useful commands

```powershell
# Start DB
cd ecomm; docker compose up -d

# Dev (web + api together)
cd ecomm; npm run dev

# Just API or just web
cd ecomm; npm run dev:api
cd ecomm; npm run dev:web

# Prisma
cd ecomm; npm run db:migrate:dev -- --name <name>
cd ecomm; npm run db:studio
cd ecomm; npm run db:seed

# Typecheck whole repo
cd ecomm; npm run typecheck

# Tests (Docker required for integration tests)
cd ecomm; npm run test           # all tests
cd ecomm; npm run test:api       # same as above
cd ecomm; npm run test:watch     # watch mode

# Build (packages → api → web)
cd ecomm; npm run build

# Add a dep to a specific workspace from root
cd ecomm; npm install <pkg> -w apps/api
cd ecomm; npm install <pkg> -w packages/db
cd ecomm; npm install -D <pkg> -w apps/web
```

## Cloudinary integration (1.5 — done)

- `CLOUD_NAME`, `API_KEY`, `API_SECRET` in `apps/api/.env` (`requireInProd`)
- Current API endpoint **`POST /images/upload`** accepts multipart `file` via multer, uploads server-side to Cloudinary, and returns `{ url, publicId }`
- Current API endpoint **`DELETE /images`** accepts `{ publicId }` for best-effort cleanup
- Desired hardening target: replace/augment with **`POST /images/sign`** so the browser uploads directly to Cloudinary using a signed payload and the API never handles image bytes
- On product create/update, web POSTs `[{url, publicId, alt?, position}]` array (max 6, validated by zod)
- Render-time transforms via URL params via `cloudinaryUrl(publicId, preset)` in `@repo/shared`:
  - Thumbnail (admin lists, cart): `w_120,h_120,c_fill,q_auto,f_auto`
  - Card (product grid): `w_400,h_400,c_fill,q_auto,f_auto`
  - Detail main (gallery): `w_1200,h_1200,c_limit,q_auto,f_auto`

## API surface (current)

```
GET    /                       { message: "API is running" }
GET    /health                 DB ping
GET    /health/live            liveness (Render)

POST   /auth/signup            (rate-limited)
POST   /auth/signin            (rate-limited)
POST   /auth/signout
POST   /auth/sign-out-all       invalidate all sessions (requires auth)
GET    /auth/me
PATCH  /auth/me                 update profile
POST   /auth/change-password

GET    /addresses               list own addresses
POST   /addresses               create address
PUT    /addresses/:id           update own address
DELETE /addresses/:id           delete own address

GET    /categories
GET    /categories/slug/:slug
GET    /categories/:id
POST   /categories             (admin)
PUT    /categories/:id         (admin)
DELETE /categories/:id         (admin)

GET    /products               (q?, categoryId?, categoryIds?, cursor?, limit?)
GET    /products/slug/:slug
GET    /products/:id
POST   /products               (admin)
PUT    /products/:id           (admin)
DELETE /products/:id           (admin)

POST   /images/upload          (admin) — multipart server-side Cloudinary upload
DELETE /images                 (admin) — best-effort Cloudinary destroy by publicId

GET    /cart
POST   /cart/items
PATCH  /cart/items/:productId
DELETE /cart/items/:productId
DELETE /cart                   (clear)
POST   /cart/summary            (pricing breakdown via calculatePricing from @repo/shared)

POST   /orders                 (from cart, idempotent)
GET    /orders                 (own; admin can pass ?scope=all)
GET    /orders/:id
POST   /orders/:id/cancel
PATCH  /orders/:id/status      (admin: PROCESSING / SHIPPED / DELIVERED) — NOT REFUNDED
POST   /orders/:id/refund      (admin: calls Stripe, returns 202 with refundId)

POST   /payments/intent        (create Stripe PI for order, idempotent, rate-limited)
POST   /payments/webhook       Stripe signed webhook (raw body) → handles succeeded, failed, refunded
```

---

## Phase 1 — Gap fixing & hardening

Goal: every fix is a small PR-sized change that touches existing code only. No new infra services. After P1 the repo is *correct, tested, and CI-green* — ready to layer P2 infra on top.

Items are grouped by tier (S = correctness/money-safety; A = polish that visibly differentiates; B = ecomm domain depth). Tackle Tier S in order first.

### Progress Summary

| # | Item | Status |
|---|------|--------|
| 1.1 | Idempotency on POST /orders | ✅ Done (with bug fix) |
| 1.2 | Order address snapshot | ✅ Done |
| 1.3 | WebhookEvent dedupe table | ✅ Done |
| 1.4 | Real Stripe refund path | ✅ Done |
| 1.5 | Expand webhook coverage | ✅ Done |
| 1.6 | Abandoned-PENDING sweeper | ✅ Done |
| 1.7 | CSRF protection | ✅ Done |
| 1.8 | Session invalidation (tokenVersion) | ✅ Done |
| 1.9 | Tighter rate limits | ✅ Done |
| 1.10 | Atomic cart add/update | ✅ Done |
| 1.11 | Email case-folding (citext) | ✅ Done |
| 1.12 | Hot-path requireAuth cache (LRU) | ✅ Done |
| 1.13 | Split order creation from payment intent | ✅ Done |
| 1.14 | Safer uncaughtException handling | ✅ Done |
| 1.15 | Doc/code drift cleanup | ✅ Done |
| 1.16 | Missing admin guards on write endpoints | ✅ Done (was already in code, doc was stale) |
| 1.17 | IDOR vulnerabilities | ✅ Done (was already in code, doc was stale) |
| 1.18 | Missing zod validation on image routes | ✅ Done |
| 1.19 | JWT_SECRET min length only enforced in prod | ✅ Done |
| 1.20 | .gitignore ignores .editorconfig | ⏸️ Skipped |
| 1.21 | Console.log/error → structured logging prep | ✅ Done |
| 1.22 | Test suite (unit + integration) | ✅ Done |
| 1.23 | GitHub Actions CI | ✅ Done |
| 1.24 | Multi-stage Dockerfiles | ✅ Done |
| 1.25 | OpenAPI spec at /docs | ✅ Done |
| 1.26 | Sentry on API + web | ⬜ Not started |
| 1.27 | README upgrade | ✅ Done |
| 1.28 | Optimistic cart UI | ✅ Done |
| 1.29 | SEO basics | ✅ Done |

### Tier S — correctness & money-safety (do these first, in order)

#### 1.1 — Idempotency on `POST /orders` ✅ DONE
- **Middleware:** `apps/api/src/middlewares/idempotency.ts`
  - Key scoped to `(userId, key)` with body hash to detect conflicts
  - Caches 2xx responses for 24h, replays on retry
  - Stale IN_PROGRESS claims cleaned up so crashed processes don't block checkout
- **Frontend:** `getCheckoutAttemptKey()` in `CheckoutClient.tsx`
  - Key is cached in `sessionStorage` keyed by cart fingerprint so refreshes during checkout return the same idempotency key and the backend replays the cached response.
  - Key is cleared in `PayForm.onSubmit` just before `stripe.confirmPayment()` — prevents the next checkout visit from replaying stale cached responses (which would return a client secret for a now-terminal PaymentIntent).

#### 1.2 — Order address snapshot ✅ DONE
- **Schema:** Order has `shippingName`, `shippingPhone`, `shippingLine1`, `shippingLine2?`, `shippingCity`, `shippingState?`, `shippingPostalCode`, `shippingCountry`
- **Address model:** has `name` + `phone` fields
- **Migration:** `20260510065250_order_address_snapshot`

#### 1.3 — `WebhookEvent` dedupe table ✅ DONE
- **Migration:** `20260510071212_webhook_event_dedupe`
- **Schema model:** `WebhookEvent { id, provider, eventId @unique, type, receivedAt, processedAt?, payload Json }`
- **Controller:** INSERT first, on P2002 return 200 immediately (dedup), set `processedAt` only after handler succeeds

#### 1.4 — Real Stripe refund path ✅ DONE
- **Endpoint:** `POST /orders/:id/refund` (admin only, returns 202 with `{ refundId }`)
- **Service method:** `ordersService.refundOrder()` calls `stripe.refunds.create({ payment_intent })`
- Removed `PAID → CANCELLED` and `PROCESSING → CANCELLED` from transition table (must be REFUNDED)

#### 1.5 — Expand webhook event coverage ✅ DONE
- Added `charge.refunded` handler in `payments.controller.ts`
- **Service method:** `ordersService.markRefundedByPaymentIntent()`
- Updates order to REFUNDED, restores inventory, updates payment status to REFUNDED
- Idempotent — only transitions from held states (PAID/PROCESSING/SHIPPED/DELIVERED)

#### Frontend updates (not in original handoff — discovered during implementation)
- **OrderStatusControls.tsx** — `NEXT_STEPS` updated to match new backend transitions (removed PAID/PROCESSING → CANCELLED); REFUND now calls `POST /orders/:id/refund` (Stripe) instead of `PATCH /status`; label changed to "Initiate Refund"

#### 1.6 — Abandoned-PENDING sweeper ✅ DONE
- **Script:** `apps/api/src/jobs/sweepAbandonedOrders.ts`
  - Selects `Order.status = PENDING AND createdAt < now() - 30 min`
  - Cancels Stripe PaymentIntent best-effort via `stripe.paymentIntents.cancel()`
  - Transitions order to `CANCELLED` and restores inventory; marks associated payment as FAILED
- **npm script:** `npm run job:sweep` in root package.json
- To run on Render: add a Cron job calling `npm run job:sweep` every 5 min
- P2 will move this to BullMQ repeat job

#### 1.7 — CSRF protection on cookie-auth POSTs ✅ DONE
- **Server:** `apps/api/src/middlewares/csrf.ts` — requires `X-Requested-With: fetch` header on all mutating requests (POST/PUT/PATCH/DELETE); excludes `/payments/webhook`
- **Web client:** `X-Requested-With: fetch` added to `services/apiClient.ts` for all mutating requests
- GET requests are safe and don't require the header

#### 1.8 — Session invalidation on password change / sign-out-all ✅ DONE
- `tokenVersion: Int @default(0)` on `User` — embed `tv` in JWT payload
- `requireAuth` rejects if `payload.tv !== user.tokenVersion`
- `changePassword` bumps `tokenVersion` atomically + issues fresh JWT; current session stays valid, all others invalidated
- `signOutAll` bumps `tokenVersion` to wipe all outstanding 7-day sessions instantly (returns 204 + clears cookie)
- `changePassword` returns `200 { user, token }` (replaces auth cookie); `signOutAll` returns `204 + clearAuthCookie`
- `signup` and `signin` also embed `tv` and issue fresh tokens on each auth action

#### 1.9 — Tighter rate limits ✅ DONE
- Added `changePasswordLimiter` (10 req/15min) on `/auth/change-password`, keyed on `req.user?.id ?? ipKeyGenerator(req.ip)` to avoid shared-NAT collisions and normalize IPv6 addresses safely.
- Added `createOrderLimiter` (20 req/15min) on `POST /orders` only (`skip` non-POST), using the same user-ID/IP keying strategy.
- Existing auth rate-limit: 30 req/15min on `/auth/signin` + `/auth/signup` ✅ unchanged.
- `trust proxy` enabled for correct client IP detection behind reverse proxies/load balancers.

#### 1.10 — Atomic cart add/update ✅ DONE
- Replaced `findProduct → findCart → read quantity → upsert absolute` in `addItem` with `upsert cart → upsert cartItem { increment } → guarded clamp`.
- The `increment` in `cartItem.upsert` closes the TOCTOU window where two concurrent requests both read the old quantity and write back an absolute value — only the database wins the increment race.
- After increment, a guarded `updateMany` clamps to `product.stock` only if `quantity > stock` (no-op if another request already removed items). If clamped, throws `INSUFFICIENT_STOCK`.
- Note: product stock is still read before the upsert (to know the ceiling), which is fine — the final stock guard lives in order creation via conditional `updateMany`.

#### 1.11 — Email case-folding at the schema layer ✅ DONE
- Enabled Postgres `citext` extension and changed `User.email` to `@db.Citext` — case-insensitive comparisons at the database level.
- Migration `20260514174237_citext_email_case_folding`: creates `citext` extension, alters `email` to `CITEXT` type.
- Removed three `.toLowerCase()` calls in [auth.service.ts](apps/api/src/modules/auth/auth.service.ts) (signup lookup, signup create, signin lookup) — the DB handles case folding now.

#### 1.12 — Hot-path `requireAuth` cache (in-process TTL) ✅ DONE
- Created [cache.ts](apps/api/src/lib/cache.ts) — simple `TtlCache` backed by `Map` with per-key expiry. Exports `userCache` singleton typing `{ id, role, tokenVersion }`.
- [requireAuth.ts](apps/api/src/middlewares/requireAuth.ts): on cache hit with matching `tokenVersion`, skips the DB round-trip entirely. On miss, queries DB and populates cache (60s TTL).
- Cache invalidation in [auth.service.ts](apps/api/src/modules/auth/auth.service.ts): `userCache.del(userId)` after `changePassword` and `signOutAll` (both bump `tokenVersion`).
- P2 swaps `TtlCache` for Redis — the `get/set/del` interface stays identical.

#### 1.13 — Split order creation from payment intent ✅ DONE
- **`POST /orders`** now only creates the PENDING order + deducts stock + clears cart. Returns `{ order }` without a client secret. The Payment row is created with `providerPaymentId: null`.
- **`POST /payments/intent`** (new endpoint) creates a Stripe PaymentIntent for an existing PENDING order, stores the PI id on the Payment row, and returns `{ clientSecret, order }`. Both endpoints accept `Idempotency-Key`.
- **New files:** `apps/api/src/modules/payments/payments.service.ts` with `createPaymentIntent(orderId, userId)`.
- **Frontend:** `CheckoutClient.tsx` now calls the two endpoints in sequence with distinct idempotency keys (`${baseKey}:order` and `${baseKey}:intent`).
- **Rate limiting:** `POST /payments/intent` has its own rate limiter (20 req/15min, keyed by user ID).
- The abandoned-PENDING sweeper already handles orders without a linked PI — no changes needed.
- **Companion fix:** Order detail page PENDING banner now links to `/orders/[id]/pay` (new Next.js page at `apps/web/app/(public)/orders/[id]/pay/page.tsx`) instead of `/checkout` (dead end — cart is already cleared). The new page calls `POST /api/payments/intent` internally and renders Stripe Elements so users can resume payment for an existing PENDING order.

#### 1.14 — Safer `uncaughtException` handling ✅ DONE
- [server.ts](apps/api/src/server.ts): `uncaughtException` logs + calls `shutdown()` → `server.close()` + 10s hard-exit safety net (`setTimeout(() => process.exit(1), 10_000).unref()`)
- `SIGINT`/`SIGTERM` also call `shutdown()` for consistent graceful shutdown
- `unhandledRejection` logs but does not crash (async errors surface there; let them be caught by errorHandler)

#### 1.15 — Doc/code drift cleanup ✅ DONE
- **Cloudinary drift**: multer `/images/upload` is current; `/images/sign` (signed direct-from-browser upload) remains the hardening target for Phase 1. No change needed.
- **Route drift**: All documented routes verified in code — no drift found.
- **Public inactive product leak**: Fixed — `getById` now queries `where: { id, isActive: true }` so unauthenticated users cannot discover inactive products by ID enumeration.
- **CORS error handling**: Fixed — replaced `cb(new Error(...))` with `cb(null, false)` for clean 4xx responses without polluting error logs.
- **Body size limits**: Removed from plan — unnecessary with multer handling file uploads and express.json defaults being reasonable for API payloads.
- **Repo polish**: `.gitignore` still ignores `.editorconfig` — tracked separately as item 1.20.

#### 1.16 — Missing admin guards on write endpoints ✅ DONE
- **Images**: [images.routes.ts:9](apps/api/src/modules/images/images.routes.ts#L9) — `imagesRouter.use(requireAuth, requireAdmin)` applies to entire router ✅
- **Categories**: [categories.routes.ts:22-36](apps/api/src/modules/categories/categories.routes.ts#L22-L36) — all three write endpoints (`POST /`, `PUT /:id`, `DELETE /:id`) include `requireAuth, requireAdmin` ✅
- **Products**: [products.routes.ts:26-40](apps/api/src/modules/products/products.routes.ts#L26-L40) — all three write endpoints include `requireAuth, requireAdmin` ✅
- **Orders status/refund**: [orders.routes.ts:30,34](apps/api/src/modules/orders/orders.routes.ts#L30) — `PATCH /:id/status` and `POST /:id/refund` both include `requireAdmin` ✅
- **Note:** This was already implemented in code when the HANDOFF was written; the doc was stale.

#### 1.17 — IDOR vulnerabilities ✅ DONE
- **Address CRUD**: All methods in [auth.service.ts](apps/api/src/modules/auth/auth.service.ts) verify ownership:
  - `listAddresses` (line 122-128): filters `where: { userId }` ✅
  - `createAddress` (line 130-145): scopes to `userId` from auth token ✅
  - `updateAddress` (line 147-172): fetches existing address, checks `existing.userId !== userId` → throws NOT_FOUND ✅
  - `deleteAddress` (line 175-184): same ownership check before delete ✅
- **Order access**: All guarded in [orders.service.ts](apps/api/src/modules/orders/orders.service.ts):
  - `getById` (line 300-301): `!isAdmin && order.userId !== userId` → forbidden ✅
  - `cancel` (line 320): `!isAdmin && existing.userId !== userId` → forbidden ✅
  - `list` (line 274): `isAdmin ? {} : { userId }` scoped; controller requires admin to explicitly pass `?scope=all` (stronger than originally planned) ✅
- **Note:** All address and order ownership checks were already in place; the doc was stale.

#### 1.18 — Missing zod validation on image routes ✅ DONE
- **Schema**: Created `packages/shared/src/schemas/image.ts` with `deleteImageSchema` (`z.object({ publicId: z.string().min(1) })`)
- **Barrel**: Added `export * from "./schemas/image"` to `packages/shared/src/index.ts`
- **Route**: Wired `validate(deleteImageSchema)` on `DELETE /images` route — consistent with all other mutation endpoints
- **Controller**: Removed manual `typeof publicId !== "string"` check — zod validation handles it via the pipeline
- **POST /images/upload**: Multer handles file validation; no body schema needed today

#### 1.19 — JWT_SECRET minimum length only enforced in production ✅ DONE
- **Fix**: Removed the `isProd` guard — `JWT_SECRET` must be ≥32 chars in all environments. Also dropped "in production" from the error message.
- **Risk addressed**: A short JWT secret in development/staging trivially allows HS256 token forgery, which is a security bug regardless of environment.

#### 1.20 — `.gitignore` ignores `.editorconfig` (SKIPPED on purpose)
- **Current**: [.gitignore:37](.gitignore#L37) — `.editorconfig` is listed under "Editor / OS" ignores.
- **Context**: The HANDOFF says "stop ignoring `.editorconfig` at minimum" if the repo is going to GitHub for resume review. The file enforces 4-space indentation and LF line endings project-wide.
- **Fix**: Remove `.editorconfig` from `.gitignore`. Also review whether `context/` (line 60) should remain ignored or be committed (handoff docs may be useful to reviewers).

#### 1.21 — Console.log/error usage → structured logging prep ✅ DONE
- **Created** `apps/api/src/lib/logger.ts` — thin `logger.info/warn/error` wrapper over `console.*`. Zero dependencies; P2.10 pino swap is a one-line change per method.
- **Replaced 19** direct `console.*` calls across 6 files:
  - [server.ts](apps/api/src/server.ts) (4×: startup, shutdown, unhandledRejection, uncaughtException)
  - [errorHandler.ts](apps/api/src/middlewares/errorHandler.ts) (1×: unhandled error)
  - [idempotency.ts](apps/api/src/middlewares/idempotency.ts) (3×: cleanup, cache update, claim release)
  - [cloudinary.ts](apps/api/src/lib/cloudinary.ts) (1×: destroy failure)
  - [payments.controller.ts](apps/api/src/modules/payments/payments.controller.ts) (3×: unknown PaymentIntent warnings)
  - [sweepAbandonedOrders.ts](apps/api/src/jobs/sweepAbandonedOrders.ts) (5×: stripe cancel, sweep log, sweep error, summary, fatal)
- **Note:** `orders.service.ts` had no console calls (doc count was stale).

### Tier A — visible polish & differentiators

#### 1.22 — Test suite ✅ DONE
- **Lint fix:** Fixed `CartBadge.tsx` `react-hooks/set-state-in-effect` by deriving `count` from `rawCount` + `isAuthenticated` (no setState in effect body). `CheckoutClient.tsx` unused `Link` import was already resolved.
- **Test infrastructure:** `vitest` + `supertest` + **Testcontainers** (Postgres 16 Alpine) in `apps/api/test/`.
  - `vitest.config.ts` at `apps/api/` with `@repo/shared` and `@repo/db` path aliases, `fileParallelism: false` (shared test DB).
  - `globalSetup.ts` starts a per-run Postgres container, runs `prisma migrate deploy`.
  - `setup.ts` reads the container URL and sets `DATABASE_URL` before test modules load.
  - `helpers.ts` provides `makeApp()`, `request(app)`, `cleanDb()`, `createTestUser()`, `createAdminUser()`, `createTestProduct()`, `createTestCategory()`.
- **Unit tests** (`test/unit/`):
  - [money.test.ts](apps/api/test/unit/money.test.ts) — 10 tests: `decimalsFor`, `formatMoney`, `parseMoney`.
  - [pricing.test.ts](apps/api/test/unit/pricing.test.ts) — 7 tests: shipping thresholds, tax calculation, edge cases.
  - [status-transitions.test.ts](apps/api/test/unit/status-transitions.test.ts) — 17 tests: parameterized matrix of all allowed transitions, terminal statuses, refundability.
- **Integration tests** (`test/integration/`):
  - [auth.test.ts](apps/api/test/integration/auth.test.ts) — 11 tests: signup (201/409/400), signin (200/401), me (200/401), change-password (200 with tokenVersion invalidation/401), sign-out-all (204 + old token rejected).
  - [cart.test.ts](apps/api/test/integration/cart.test.ts) — 10 tests: get empty, add (201), increment, stock clamp (409), auth required (401), update quantity, remove via qty=0, delete item, clear cart.
  - [orders.test.ts](apps/api/test/integration/orders.test.ts) — 7 tests: create order (201 + stock deduction + cart clear), empty cart (400), idempotency replay (201 cached), list own orders, IDOR (other user sees empty), cancel (200 + stock restore), cancel non-PENDING (409).
- **Not yet covered (deferred):** Stripe webhook integration tests (require Stripe test mode mocking), Playwright e2e, concurrent cart race test.
- **Exported** `ALLOWED_TRANSITIONS` from [orders.service.ts](apps/api/src/modules/orders/orders.service.ts) for testability.
- **Scripts:** `npm run test -w apps/api` (all), `npm run test:watch -w apps/api`, `npm run test:unit -w apps/api` (unit only), `npm run test:integration -w apps/api` (integration only). Root also has `npm run test` and `npm run test:api`.

#### 1.23 — GitHub Actions CI ✅ DONE
- **File:** `.github/workflows/ci.yml`
- **Jobs:** `lint` (web eslint) → `typecheck` (api + web via root script) → `test:api` (vitest + Testcontainers, requires Docker) → `build` (full monorepo, depends on all prior jobs)
- **Caching:** npm cache via `setup-node`; Prisma engine cache via `actions/cache` keyed on schema hash
- **Test infrastructure:** Uses existing Testcontainers setup (Postgres 16 Alpine container started programmatically in `globalSetup.ts`). `ubuntu-latest` runners have Docker pre-installed.
- **Node version:** 22 (within project's `>=20.19 <23` range)
- **Note:** `test:web` skipped — web has no test suite yet (deferred to future). Block-PR-merge-on-red must be configured in GitHub repo settings (Settings → Branches → main → Require status checks).

#### 1.24 — Multi-stage Dockerfiles ✅ DONE
- **`apps/api/Dockerfile`:**
  - Two-stage: `build` (compiles TypeScript + prisma generate, with `python3 make g++` for argon2 native build) → `prod` (Alpine, copies `node_modules`, built `dist/`, prisma migrations + config).
  - Non-root user `nodejs` (1001:1001).
  - `HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD wget -qO- http://localhost:5000/health/live || exit 1`.
  - CMD runs `db:migrate:deploy && db:seed && node apps/api/dist/server.js` (matching Render blueprint).
  - `ENV PORT=5000`, `EXPOSE 5000`.
- **`apps/web/Dockerfile`:**
  - Two-stage: `build` (compiles workspace packages + `next build` with `output: "standalone"`) → `prod`.
  - Non-root user `nodejs` (1001:1001).
  - `HEALTHCHECK` against `http://localhost:3000/` (Next.js has no dedicated health route; the public homepage suffices).
  - Standalone output is copied to `/app/` (flat), plus `.next/static` and `public/`.
  - Build args for `NEXT_PUBLIC_*` vars (inlined at build time).
  - `ENV PORT=3000`, `EXPOSE 3000`.
- **`next.config.ts`:** Added `output: "standalone"` for production Docker builds.
- **`.dockerignore`:** Created at repo root (excludes `node_modules`, `dist`, `.next`, `.env*`, `.git`, tests, docs, etc.).
- **`docker-compose.yml`:** Added `api` and `web` services under the `build` profile. Use: `docker compose --profile build up`. The `api` service depends on `postgres` (healthy); the `web` service depends on `api`.

#### 1.25 — OpenAPI spec at `/docs` ✅ DONE
- **Dependencies:** `@asteasolutions/zod-to-openapi@^8.5` in both `apps/api` and `@repo/shared`; `swagger-ui-express@^5`, `@types/swagger-ui-express` (dev) in `apps/api`.
- **Central patched zod:** `packages/shared/src/lib/zod.ts` calls `extendZodWithOpenApi(z)` before re-exporting `z`. All schema files in `@repo/shared` import `z` from `../lib/zod` (not from `"zod"`). This guarantees `.openapi()` is available on every schema instance regardless of module load order.
- **`apps/api/src/lib/openapi.ts`:** Full OpenAPI 3.0.3 document generator using `OpenAPIRegistry` + `OpenApiGeneratorV3`. Imports `z` and all schemas from `@repo/shared` (not `zod` directly).
  - All request schemas from `@repo/shared` registered as component schemas (SignupInput, ProductCreate, etc.).
  - Response component schemas for UserResponse, ProductResponse, OrderResponse, CartResponse, AddressResponse, ErrorResponse, etc. registered as raw components.
  - Cookie-based security scheme (`cookieAuth` → `kartit_auth`).
  - All 40+ endpoints documented with method, path, summary, tags, request body/query, parameters (Idempotency-Key header on `/orders` and `/payments/intent`), response codes (200/201/204/400/401/403/404/409/429/503).
  - Common response helpers (`ok`, `created`, `badRequest`, `unauthorized`, etc.) keep path definitions DRY.
- **`apps/api/src/modules/docs/docs.routes.ts`:**
  - `GET /docs.json` — raw OpenAPI JSON.
  - `GET /docs` — Swagger UI (served by `swagger-ui-express`, branded "KartIt API Docs"). Gated behind `requireAdmin` in production, open in dev.
- **`apps/api/src/app.ts`:** `docsRouter` mounted at `/docs`.

#### 1.26 — Sentry on API + web (SKIPPED on purpose)
- `@sentry/node` in `app.ts`; `@sentry/nextjs` in `web`. Tag `release` from git sha.

#### 1.27 — README upgrade ✅ DONE
- **Created** [README.md](README.md) with architecture diagram (mermaid), tech stack table, "Run locally in 60s" guide, Stripe test cards table + webhook CLI instructions, full API overview, project structure, available scripts, testing guide, and deployment checklist.
- **Skipped:** live demo link + screenshots (explicitly excluded).

#### 1.28 — Optimistic cart UI ✅ DONE
- **Component:** [CartItemControls.tsx](apps/web/components/CartItemControls.tsx) — uses React 19 `useOptimistic` hook; quantity display updates instantly on +/- click before the API call completes.
  - `addOptimistic(newQty)` called synchronously (outside `startTransition`) for immediate render.
  - API call fires after; on success, `router.refresh()` wrapped in `startTransition` syncs with server. On failure, React auto-reverts `optimisticQty` to the server `qty` prop since it never changed.
  - Button disabled state and display both driven by `optimisticQty` (not the prop `qty`), so UI never lags behind rapid clicks.
- **CartBadge fix:** [CartBadge.tsx](apps/web/components/CartBadge.tsx) simplified to accept `count` prop instead of fetching in `useEffect`. [Navbar.tsx](apps/web/components/Navbar.tsx) now fetches cart count server-side and passes it down. `router.refresh()` re-renders the Navbar (server component), so the badge updates immediately after any cart mutation.

#### 1.29 — SEO basics ✅ DONE
- **[sitemap.ts](apps/web/app/sitemap.ts):** Dynamic sitemap (`force-dynamic`) enumerates home, search, all active products (cursor-paginated, priority 0.8, weekly), and all categories (priority 0.7, weekly). Resolves `SITE_URL` from `NEXT_PUBLIC_SITE_URL` → `VERCEL_URL` → `http://localhost:3000`.
- **[robots.ts](apps/web/app/robots.ts):** Allows `*`, disallows `/account/`, `/admin/`, `/profile/`, `/checkout/`, `/orders/`, `/api/`. Points to `/sitemap.xml`.
- **[p/[slug]/page.tsx](apps/web/app/(public)/p/[slug]/page.tsx):** `generateMetadata` returns product name, description (truncated to 200 chars), and OG image (first product image via Cloudinary card preset, 400×400).

### Tier B — ecomm domain depth

#### 1.30 — Human-readable order numbers ✅
- `Order.orderNumber String @unique` — format `ECM-YYYYMMDD-XXXXXX` generated in `orders.service.ts`.
- Surfaced in customer order list/detail and admin order list/detail; CUID never exposed.

#### 1.31 — `Product.sku String @unique` + barcode ✅
- Required field on product create/edit form (`ProductForm.tsx`). Displayed in admin product table.

#### 1.32 — Soft delete on `Product` + `Category` ✅
- `deletedAt DateTime?` on both models. All queries filter `deletedAt: null`.
- Category deletion cascades soft-delete to children and their products in a transaction.
- Cart and order services check `deletedAt` before allowing operations.

#### 1.33 — `OrderItem` snapshot enrichment ✅
- `productSlug` and `imageUrl` fields on `OrderItem`, copied from `Product` at order creation time so order history survives product changes/deletion.

#### 1.34 — Inventory adjustment log **[SKIPPED]**
- ~~New model `InventoryEntry { productId, delta, reason: SOLD|RETURNED|DAMAGED|RECOUNT|MANUAL, orderId?, actorUserId?, createdAt }`.~~
- ~~Every `stock` change writes one entry. `Product.stock` becomes a derived/cached column reconciled from the entries.~~

#### 1.35 — Discount codes (basic) ✅
- `Promotion` model with `code @unique`, `type: PERCENTAGE|FIXED_AMOUNT`, `value`, `minSubtotalMinor?`, `maxUses?`, `maxUsesPerUser?`, `startsAt?`, `endsAt?`, `isActive`.
- Full admin CRUD at `/admin/promotions`. Applied at checkout; snapshot on `Order` (`promotionCode`, `discountMinor`).

#### 1.36 — Returns / RMA flow **[SKIPPED — `RefundRequest` exists instead]**
- A simpler `RefundRequest` model (PENDING|APPROVED|REJECTED) with Stripe refund on approval satisfies the core need. Full RMA (RECEIVED warehouse tracking, RMA numbers) skipped.
- ~~`Return { id, orderId, status: REQUESTED|APPROVED|RECEIVED|REFUNDED|REJECTED, reason, createdAt }`.~~
- ~~Admin approves → triggers refund flow from 1.4.~~

#### 1.37 — 3DS / SCA handling on web **[SKIPPED — Payment Element handles it]**
- Stripe Payment Element's built-in `confirmPayment()` redirect flow covers 3DS/SCA without explicit `handleNextAction` code. Dedicated "Verifying with your bank…" UI skipped.
- ~~Detect `payment_intent.requires_action` and call `stripe.confirmCardPayment` / `handleNextAction` from the web side.~~
- ~~Show "Verifying with your bank…" UI.~~

#### 1.38 — Search index **[SKIPPED]**
- Current `contains` + `mode: "insensitive"` query on name/description is adequate for the project scope. Full-text tsvector/GIN index skipped.
- ~~Postgres `tsvector` column on `Product` (name + description), GIN index. `q` filter switches from `contains` to `to_tsquery`.~~

---

## Phase 2 — Production-grade infra (earns the resume bullets)

Each item is **additive** to Phase 1 — no rewrites of business logic.

### 2.1 — Redis foundation
- Add Redis service to `docker-compose.yml`.
- `ioredis` client singleton in `apps/api/src/lib/redis.ts`.
- `/health` upgraded to also ping Redis; `/readyz` requires both.
- Migrate the LRU cache from 1.12 to Redis.

### 2.2 — Idempotency middleware moved to Redis hot path
- The `IdempotencyKey` Postgres table from 1.1 stays as a durable fallback.
- Hot path: `SET key value NX EX 86400` in Redis.
- Background job promotes long-lived keys to Postgres.

### 2.3 — Outbox pattern + BullMQ + worker service
- New schema: `Outbox { id, aggregateType, aggregateId, eventType, payload, status, attempts, lastError, createdAt, sentAt? }`.
- New app: `apps/worker` running BullMQ workers.
- Queues: `order-events`, `emails`, `reconciliation`, `webhooks-retry`, `inventory-sweep`.
- **Outbox dispatcher**: polls `status=PENDING` → enqueues to BullMQ → marks `SENT` (guarantees at-least-once delivery despite tx rollback).
- Order/payment services write to `Outbox` **in the same Prisma transaction** as state changes.
- Order paid → enqueues `send-receipt-email` + `write-ledger-entries`.
- DLQ + exponential backoff + jitter; alert when DLQ depth > 0.

### 2.4 — Double-entry ledger
- New schema: `LedgerEntry { account, direction: DEBIT|CREDIT, amountMinor BigInt, currency, orderId?, paymentId?, reference?, memo?, createdAt }`.
- Stripe webhook handler writes entries on `PAID` / `REFUND` (CASH ↔ REVENUE / REFUNDS / FEES / TAX).
- Admin endpoint `GET /admin/ledger` shows balance per account per currency.
- Constraint: `sum(debits) === sum(credits)` per `(currency, transaction batch)`. Daily integrity check.

### 2.5 — Stripe reconciliation job
- Nightly cron worker pulls Stripe `balance_transactions` (paginated, since last cursor).
- Joins against `LedgerEntry` by reference (charge id).
- Writes a `ReconciliationReport { runAt, drift, mismatchedRefs[] }` row, alerts on `drift > 0`.
- Resume bullet: "balance drift <1¢ across 10k+ simulated transactions".

### 2.6 — Risk engine
- `apps/api/src/lib/risk/` with composable rules: velocity (orders/24h/user+ip), geo-mismatch (BIN country vs ship country), disposable email, first-order-high-value, address blacklist, BIN check.
- Each rule returns `{ score, reason }`; total score routes to `ALLOW / REVIEW / BLOCK`.
- Add `riskScore`, `riskReasons String[]`, and `OrderStatus.REVIEW` to `Order`.
- Admin review queue page; transition `REVIEW → PAID` or `REVIEW → CANCELLED` (refund).
- Resume bullet: "<5ms p99 per scoring decision".

### 2.7 — Inventory safety under concurrency
- Replace optimistic decrement with `pg_advisory_xact_lock(hashtext(productId))` inside the order create tx.
- (Redlock optional — only useful if the API horizontally scales beyond one PG cluster.)
- Reservation model: split `Product.stock` into `physicalStock` (only changes on ship/return) and `reservedQty` (incremented on order create, decremented on cancel/ship).
- k6 concurrency test: 200 concurrent checkouts of a 10-stock SKU; assert exactly 10 succeed.

### 2.8 — Token-bucket rate limiting (Redis)
- Replace in-memory `express-rate-limit` with a Redis-backed token-bucket on `/auth/*`, `POST /orders`, `POST /payments/intent`.
- 429 with `Retry-After` header.

### 2.9 — Webhook retry pipeline
- The `WebhookEvent` table from 1.3 gains `attempts`, `nextAttemptAt`, `lastError`.
- Failed events go to `webhooks-retry` queue with capped attempts and exponential backoff.
- Replay endpoint for ops: `POST /admin/webhooks/:id/retry`.

### 2.10 — Observability
- `pino` structured logging + request_id via `AsyncLocalStorage` (replaces all `console.*` — see [10 hits](apps/api/src) across server.ts, errorHandler.ts, payments.controller.ts, orders.service.ts, cloudinary.ts).
- OpenTelemetry SDK → OTLP exporter → Jaeger in compose; auto-instrument http + pg + ioredis + bullmq.
- `prom-client` exposing `/metrics`; Grafana dashboard JSON committed under `infra/grafana/`.
- Split health: `/livez` (no deps), `/readyz` (DB + Redis + worker queue depth).
- Graceful shutdown drains in-flight requests + BullMQ workers.

### 2.11 — Audit log
- New schema: `AuditLog { actorUserId?, action, entityType, entityId, before Json?, after Json?, metadata Json?, createdAt }`.
- Append-only writes on every order state transition, refund, product/category edit, role change.
- Admin endpoint `GET /admin/audit?entityType=Order&entityId=...`.

### 2.12 — Refresh token rotation with reuse detection
- New schema: `RefreshToken { id, userId, familyId, tokenHash @unique, replacedById?, createdAt, expiresAt, revokedAt? }`.
- 15min access JWT + 30d refresh token (rotated on every use).
- Reuse of a rotated token revokes the entire family (`familyId`) — classic theft-detection.
- `POST /auth/refresh`, `POST /auth/sign-out-all`.

### 2.13 — Security pass
- helmet ✅ already on; tighten with strict CSP, `frame-ancestors`, `Permissions-Policy`.
- PII encryption at rest with `pgcrypto` for `Address` line/postal/phone.
- OWASP Top 10 self-audit checklist; fix any IDOR/SSRF surfaces.
- Dependency scanning: GitHub Dependabot + `npm audit --omit=dev` in CI.

### 2.14 — Stripe Tax + Shipping zones
- Replace hand-rolled `taxMinor` with Stripe Tax (`automatic_tax: { enabled: true }` on PI).
- New `ShippingZone { country, region?, methods Json }` + admin UI; `shippingMinor` derived from zone + cart weight.

### 2.15 — Email/notification system
- Resend (or Postmark) + React Email templates in `apps/web/emails/`.
- Triggered via outbox: order confirmation, shipped, delivered, refunded, dispute alerts.

### 2.16 — Load test + numbers (resume-ready)
- `k6/checkout.js` script: signup → add → checkout → poll for paid.
- Record p50/p95/p99 + RPS; commit results in `k6/results/`.
- Same numbers feed directly into the resume bullets.

### 2.17 — Deploy
- ✅ Render Blueprint already deploys API + managed Postgres.
- Add worker service deploy + Redis add-on to `render.yaml`.
- Vercel for `apps/web`.
- Live link on resume + status badge in README.

---

## Resume bullets target (after P2)

> **Ecomm-Pay | Next.js, Express, Postgres, Prisma, Redis, BullMQ, Stripe | GitHub** &nbsp; 2026
> - Architected a **distributed order-and-payments platform** with an outbox-pattern event bus and BullMQ workers, processing checkout → Stripe capture → fulfillment as an idempotent saga across **6 service states** with compensating actions
> - Implemented a **double-entry ledger** and nightly Stripe reconciliation job, detecting balance drift within **<1¢** across **10k+ simulated transactions**
> - Built a **rules-based risk engine** (velocity, geo-mismatch, BIN checks) scoring every checkout in **<5ms p99**, routing flagged orders to an admin review queue
> - Hardened APIs with **idempotency keys, PG advisory-lock inventory reservations, token-bucket rate limiting, CSRF protection, and Argon2 + rotating refresh tokens with reuse detection**, mitigating OWASP Top 10
> - Instrumented the stack with **OpenTelemetry traces, Prometheus metrics, and structured pino logs**, sustaining **500 RPS** on checkout at **p99 180ms** under k6 load
