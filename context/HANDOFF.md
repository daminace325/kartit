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
- **Skip per-workspace `.env.example` files** *(a single root `.env.example` exists — fine to keep)*
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
          errors.ts              ← AppError class
          jwt.ts                 ← signToken / verifyToken (HS256)
          cookies.ts             ← setAuthCookie / clearAuthCookie (httpOnly)
          password.ts            ← argon2id hash/verify
          cloudinary.ts          ← server SDK init + signed-upload helpers
          stripe.ts              ← Stripe SDK singleton
        middlewares/
          errorHandler.ts        ← errorHandler + notFoundHandler
          validate.ts            ← zod request validator (ZodType, Zod v4)
          requireAuth.ts         ← requireAuth + requireAdmin (extends Express.Request.user)
          csrf.ts                ← X-Requested-With: fetch check on mutating requests
          idempotency.ts         ← Idempotency-Key header middleware (24h replay cache)
          upload.ts              ← multer setup for any direct-upload endpoints
        modules/
          health/                ← /health (DB ping) + /health/live (no DB; Render probe)
          auth/                  ← auth.controller.ts + auth.service.ts; /auth/signup, /signin, /signout, /sign-out-all, /me, /change-password, profile, addresses
          categories/            ← public GET + admin CRUD
          products/              ← public GET + admin CRUD
          images/                ← POST /images/upload + DELETE /images
          cart/                  ← /cart GET, add, update, remove, clear
          orders/                ← /orders create, list, detail, cancel; admin status transitions
          payments/              ← /payments/webhook (raw body); /payments/intent planned in P1.13
        app.ts                   ← createApp(): trust-proxy, helmet, multi-origin CORS,
                                   /payments mounted BEFORE express.json() (raw webhook),
                                   auth rate-limit, all routers
        server.ts                ← env.PORT, graceful shutdown on SIGINT/SIGTERM
    web/
      .env.local                 ← NEXT_PUBLIC_API_URL=http://localhost:5000
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
          orders/                ← order list + detail + cancel
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
                                   OrderStatusControls, CancelOrderButton
      lib/                       ← api.ts, auth.ts, auth_constants.ts, errors.ts,
                                   image.ts, order_status.ts, strings.ts
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
        index.ts                 ← barrel + API_URL
        money.ts                 ← formatMoney, parseMoney, decimalsFor
        enums.ts                 ← UserRole, OrderStatus, PaymentStatus (string unions)
        errors.ts                ← ErrorCode enum + ApiError types
        pricing.ts               ← subtotal / shipping / tax / total helpers
        cloudinary.ts            ← cloudinaryUrl(publicId, preset) render-time helper
        schemas/
          auth.ts                ← signup, signin, changePassword, profile, address
          product.ts             ← productCreate, listQuery, ProductDTO, image array (max 6)
          cart.ts                ← cartAddItem, cartUpdateItem
          order.ts               ← orderCreate, OrderDTO, CreateOrderResponse,
                                   admin status-transition schemas
```

## Env files (real values, not committed)

- `ecomm/.env` — `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL` (compose + Prisma CLI)
- `ecomm/apps/api/.env` — `PORT=5000`, `DATABASE_URL`, `JWT_SECRET` (≥32 chars in prod), `JWT_EXPIRES_IN=7d`, `COOKIE_NAME=ecomm_auth`, `COOKIE_SECURE`, `COOKIE_SAMESITE` (`lax`/`strict`/`none`; `none` requires Secure), `WEB_ORIGINS` (comma-separated; supports single-`*` host wildcards like `https://*.vercel.app`), `CLOUDINARY_CLOUD_NAME`/`API_KEY`/`API_SECRET`/`FOLDER`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CURRENCY=USD`
- `ecomm/apps/web/.env.local` — `NEXT_PUBLIC_API_URL=http://localhost:5000`
- `ecomm/packages/db/.env` — `DATABASE_URL` (separate, for Prisma CLI)

## Key gotchas / decisions

- **Prisma 7:** `url` lives in `prisma.config.ts`, NOT `schema.prisma`. Runtime requires `PrismaPg` adapter (`@prisma/adapter-pg` + `pg`).
- **Zod v4:** `ZodSchema` is deprecated → use `ZodType`.
- **Web cannot import from `apps/api`** — only from `@repo/shared`. `@repo/db` is server-only.
- **Refresh tokens deferred to P2** — single JWT in httpOnly cookie, 7d expiry.
- **Stripe webhook MUST be mounted BEFORE `express.json()`** in [app.ts](apps/api/src/app.ts) so signature verification sees the raw body. Router-local `express.raw()` parses it.
- **CORS:** `WEB_ORIGINS` (plural) is the env var. Each entry is exact origin or single-`*`-host wildcard. Compiled into matchers once at boot.
- **`trust proxy: 1`** is set so Render's LB gives correct `req.secure` / `req.ip` and the `Secure` cookie attribute behaves.
- **Auth rate-limit:** 30 req / 15 min on `/auth/signin` + `/auth/signup` (`express-rate-limit`, draft-7 headers).
- **P1 schema progress:** `IdempotencyKey`, `WebhookEvent`, order address snapshot fields, `User.tokenVersion` — all implemented. P2-only: `Outbox`, `LedgerEntry`, `RefreshToken` rotation family, `Reservation`.
- **Repo polish gotcha:** `.gitignore` currently ignores `.editorconfig` and `context/`; keep that intentional only if handoff/config remain local-only. If this repo is going to GitHub for resume review, stop ignoring `.editorconfig` at minimum.
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

## API surface (Foundation, current)

```
GET    /                       hello
GET    /health                 DB ping
GET    /health/live            liveness (Render)

POST   /auth/signup            (rate-limited)
POST   /auth/signin            (rate-limited)
POST   /auth/signout
POST   /auth/sign-out-all       invalidate all sessions (requires auth)
GET    /auth/me
POST   /auth/change-password
PATCH  /auth/me
GET/POST/PUT/DELETE /auth/me/addresses[/:id]

GET    /categories
GET    /categories/slug/:slug
GET    /categories/:id
POST   /categories             (admin)
PUT    /categories/:id         (admin)
DELETE /categories/:id         (admin)

GET    /products               (q?, categoryId?, cursor?, limit?)
GET    /products/slug/:slug
GET    /products/:id           ⚠ public but no isActive check (P1.15)
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

POST   /orders                 (from cart, idempotent)
GET    /orders                 (own)
GET    /orders/:id
POST   /orders/:id/cancel
PATCH  /orders/:id/status      (admin: PROCESSING / SHIPPED / DELIVERED) — NOT REFUNDED
POST   /orders/:id/refund      (admin: calls Stripe, returns 202 with refundId)

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
| 1.11 | Email case-folding (citext) | Pending |
| 1.12 | Hot-path requireAuth cache (LRU) | Pending |
| 1.13 | Split order creation from payment intent | Pending |
| 1.14 | Safer uncaughtException handling | ✅ Done |
| 1.15 | Doc/code drift cleanup | Pending |
| 1.16 | Missing admin guards on write endpoints | ✅ Done (was already in code, doc was stale) |
| 1.17 | IDOR vulnerabilities | ✅ Done (was already in code, doc was stale) |
| 1.18 | Body size limits on express.json() | Pending |
| 1.19 | Missing zod validation on image routes | 🔴 NEW GAP - not in original plan |
| 1.20 | JWT_SECRET min length only enforced in prod | 🔴 NEW GAP - not in original plan |
| 1.21 | .gitignore ignores .editorconfig | 🔴 NEW GAP — repo polish |
| 1.22 | Console.log/error → structured logging prep | 🔴 NEW GAP — prep for P2.10 |

### Tier S — correctness & money-safety (do these first, in order)

#### 1.1 — Idempotency on `POST /orders` ✅ DONE
- **Middleware:** `apps/api/src/middlewares/idempotency.ts`
  - Key scoped to `(userId, key)` with body hash to detect conflicts
  - Caches 2xx responses for 24h, replays on retry
  - Stale IN_PROGRESS claims cleaned up so crashed processes don't block checkout
- **Frontend:** `getCheckoutAttemptKey()` in `CheckoutClient.tsx`
- **Bug fix applied:** Removed `sessionStorage.removeItem()` after order creation — key now persists so payment-failed retries return cached response instead of creating duplicate orders

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
- **Web client:** `X-Requested-With: fetch` added to api.ts for all mutating requests
- **Helper:** `apps/web/lib/csrf.ts` for components using raw fetch; updated 17 files (auth pages, cart, orders, profile, admin forms)
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
- Body size limits moved to item 1.18 (separate concern).

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

#### 1.10 — Atomic cart add/update ✅ DONE
- Replaced `findProduct → findCart → read quantity → upsert absolute` in `addItem` with `upsert cart → upsert cartItem { increment } → guarded clamp`.
- The `increment` in `cartItem.upsert` closes the TOCTOU window where two concurrent requests both read the old quantity and write back an absolute value — only the database wins the increment race.
- After increment, a guarded `updateMany` clamps to `product.stock` only if `quantity > stock` (no-op if another request already removed items). If clamped, throws `INSUFFICIENT_STOCK`.
- Note: product stock is still read before the upsert (to know the ceiling), which is fine — the final stock guard lives in order creation via conditional `updateMany`.

#### 1.11 — Email case-folding at the schema layer
- Enable Postgres `citext` extension; change `User.email` to `@db.Citext`.
- Drop the per-call `.toLowerCase()` and rely on the type for uniqueness.
- Backfill migration: `UPDATE "User" SET email = lower(email)`.

#### 1.12 — Hot-path `requireAuth` cache (in-process LRU)
- 60s TTL LRU keyed by `userId`, value `{ id, role, tokenVersion }`.
- Invalidate on `changePassword`, `sign-out-all`, role change.
- P2 swaps the LRU for Redis; the interface stays the same.

#### 1.13 — Split order creation from payment intent
- Today `POST /orders` does both, which makes idempotency awkward.
- Refactor: `POST /orders` = create PENDING order + reserve stock; `POST /payments/intent` = create/return PI for a given orderId.
- Both endpoints take `Idempotency-Key`. Refresh / 3DS / re-attempt becomes safe.
- Update `CheckoutClient.tsx` to call them in sequence.

#### 1.14 — Safer `uncaughtException` handling ✅ DONE
- [server.ts](apps/api/src/server.ts): `uncaughtException` logs + calls `shutdown()` → `server.close()` + 10s hard-exit safety net (`setTimeout(() => process.exit(1), 10_000).unref()`)
- `SIGINT`/`SIGTERM` also call `shutdown()` for consistent graceful shutdown
- `unhandledRejection` logs but does not crash (async errors surface there; let them be caught by errorHandler)

#### 1.18 — Body size limits not implemented
- **Current state**: `express.json()` in [app.ts:57](apps/api/src/app.ts#L57) has no `limit` option
- **Required**: Add `express.json({ limit: '32kb' })` for normal routes, `express.json({ limit: '100kb' })` for admin product create/update (image arrays can be large)
- This was described in P1.9 but never implemented

#### 1.19 — Missing zod validation on image routes
- **`POST /images/upload`** ([images.routes.ts:11](apps/api/src/modules/images/images.routes.ts#L11)): Only multer validates the file (type + size). No zod validation on the request body/metadata.
- **`DELETE /images`** ([images.routes.ts:12](apps/api/src/modules/images/images.routes.ts#L12)): Controller does manual `typeof publicId !== "string"` check instead of using the zod validation pipeline — inconsistent with every other mutation endpoint.
- **Fix**: Add `validate(deleteImageSchema)` to `DELETE /images` route. For `POST /images/upload`, multer handles the file validation; consider adding a body schema if metadata fields are added later.

#### 1.20 — JWT_SECRET minimum length only enforced in production
- **Current**: [env.ts:32](apps/api/src/config/env.ts#L32) — `if (isProd && JWT_SECRET.length < 32)` — the check is conditional on `isProd`.
- **Risk**: In development/staging, `JWT_SECRET` can be 1 character. Since JWT uses HS256 (symmetric), a weak secret trivially allows token forgery.
- **Fix**: Make the 32-char minimum check unconditional (remove `isProd` guard). A short secret is a security bug in any environment.

#### 1.21 — `.gitignore` ignores `.editorconfig`
- **Current**: [.gitignore:37](.gitignore#L37) — `.editorconfig` is listed under "Editor / OS" ignores.
- **Context**: The HANDOFF says "stop ignoring `.editorconfig` at minimum" if the repo is going to GitHub for resume review. The file enforces 4-space indentation and LF line endings project-wide.
- **Fix**: Remove `.editorconfig` from `.gitignore`. Also review whether `context/` (line 60) should remain ignored or be committed (handoff docs may be useful to reviewers).

#### 1.22 — Console.log/error usage → structured logging prep
- **20 instances** across `apps/api/src/` — [server.ts](apps/api/src/server.ts) (4×), [errorHandler.ts](apps/api/src/middlewares/errorHandler.ts) (1×), [idempotency.ts](apps/api/src/middlewares/idempotency.ts) (3×), [cloudinary.ts](apps/api/src/lib/cloudinary.ts) (1×), [payments.controller.ts](apps/api/src/modules/payments/payments.controller.ts) (3×), [orders.service.ts](apps/api/src/modules/orders/orders.service.ts) (2×), [sweepAbandonedOrders.ts](apps/api/src/jobs/sweepAbandonedOrders.ts) (5×).
- **Issue**: No correlation IDs, no structured metadata, no timestamp formatting — makes production debugging harder. The `console.warn` calls in the payments controller for unknown PaymentIntents are especially concerning.
- **P2.10** already plans `pino` + `AsyncLocalStorage` for request_id. P1 should at minimum add a thin `logger` wrapper (just `console`-backed for now) so all logging goes through one interface, making the P2 swap to pino a one-line change.
- **Fix**: Create `apps/api/src/lib/logger.ts` with `logger.info/warn/error` that wraps `console.*` for now. Replace all direct `console.*` calls with `logger.*`. Adds zero dependencies and makes P2.10 trivial.

#### 1.15 — Doc/code drift cleanup
- **`POST /payments/intent`**: Not in the API surface yet — will add when 1.13 lands (split order creation from payment intent).
- **Cloudinary drift**: multer `/images/upload` is current; `/images/sign` (signed direct-from-browser upload) remains the hardening target for Phase 1.
- **Route drift**: All documented routes (`GET /categories/slug/:slug`, `GET /products/slug/:slug`, public `GET /products/:id`) are in use. No drift found.
- **Public inactive product leak**: `GET /products/:id` in [products.service.ts:101-107](apps/api/src/modules/products/products.service.ts#L101-L107) — `getById` doesn't check `isActive`. Unauthenticated users can view inactive products by guessing IDs. Fix: add `isActive: true` to the query or require auth.
- **CORS error handling**: [app.ts:33](apps/api/src/app.ts#L33) uses `cb(new Error(...))` which pollutes error logs when rejecting origins. Should use `cb(null, false)` for a clean 4xx response.
- **Repo polish**: `.gitignore` still ignores `.editorconfig` — tracked separately as item 1.21.

#### 1.16 — Missing admin guards on write endpoints ✅ DONE
- **Images**: [images.routes.ts:9](apps/api/src/modules/images/images.routes.ts#L9) — `imagesRouter.use(requireAuth, requireAdmin)` applies to entire router ✅
- **Categories**: [categories.routes.ts:22-36](apps/api/src/modules/categories/categories.routes.ts#L22-L36) — all three write endpoints (`POST /`, `PUT /:id`, `DELETE /:id`) include `requireAuth, requireAdmin` ✅
- **Products**: [products.routes.ts:26-40](apps/api/src/modules/products/products.routes.ts#L26-L40) — all three write endpoints include `requireAuth, requireAdmin` ✅
- **Orders status/refund**: [orders.routes.ts:30,34](apps/api/src/modules/orders/orders.routes.ts#L30) — `PATCH /:id/status` and `POST /:id/refund` both include `requireAdmin` ✅
- **Note:** This was already implemented in code when the HANDOFF was written; the doc was stale.

### Tier A — visible polish & differentiators

#### 1.23 — Test suite (this is the single biggest credibility lift)
- Before wiring CI, fix the current web lint failures:
  - `CartBadge.tsx`: `react-hooks/set-state-in-effect` from `setCount(0)` inside the effect.
  - `CheckoutClient.tsx`: unused `Link` import.
- `vitest` + `supertest` + **Testcontainers** (Postgres) for integration tests in `apps/api/test/`.
- Required coverage:
  - Auth: signup/signin/me/change-password (with tokenVersion bump).
  - Cart: add/update/remove + concurrent add race.
  - Orders: create from cart, idempotency replay, cancel restores stock.
  - Stripe webhook: succeeded / failed / refunded / event dedup via `WebhookEvent`.
  - Status transition matrix (parameterized table test).
- Pure unit tests for `pricing.ts`, `money.ts`, status-transition table.
- Playwright e2e in `apps/web/e2e/`: signup → add to cart → checkout with Stripe test card → see paid order.

#### 1.24 — GitHub Actions CI
- `.github/workflows/ci.yml`: matrix `lint` → `typecheck` → `test:api` (with PG service container) → `test:web` → `build`.
- Block PR merge on red.
- Cache npm + Prisma engines.

#### 1.25 — Multi-stage Dockerfiles
- `apps/api/Dockerfile`, `apps/web/Dockerfile`: multi-stage, non-root user, `HEALTHCHECK` against `/health/live`.
- Test locally with `docker compose --profile build up`.

#### 1.26 — OpenAPI spec served at `/docs`
- Use `@asteasolutions/zod-to-openapi` to generate from the existing `@repo/shared` schemas.
- Mount Swagger UI at `/docs` (gate behind `env.isProd ? requireAdmin : noop`).

#### 1.27 — Sentry on API + web
- `@sentry/node` in `app.ts`; `@sentry/nextjs` in `web`. Tag `release` from git sha.

#### 1.28 — README upgrade
- Architecture diagram (mermaid).
- "Run locally in 60s" block.
- Test card numbers + how to fire webhooks via Stripe CLI.
- Live demo link + screenshots.

#### 1.29 — Optimistic cart UI
- `useOptimistic` in [CartItemControls.tsx](apps/web/components/CartItemControls.tsx) for +/- — instant feedback, settle on response, roll back on error.

#### 1.30 — SEO basics
- `app/sitemap.ts`, `app/robots.ts`, OG metadata on product detail pages.

### Tier B — ecomm domain depth

#### 1.31 — Human-readable order numbers
- New `Order.orderNumber String @unique` like `ECM-20260509-A1B2C3`. Computed in service layer.
- Surface in UI; never expose cuid.

#### 1.32 — `Product.sku String @unique` + barcode
- Required field on product create form.

#### 1.33 — Soft delete on `Product` + `Category` *(promote earlier if product deletes are next)*
- `deletedAt DateTime?` instead of hard delete; queries filter `deletedAt: null`.
- Avoids breaking historical orders that link back to products.
- Current risk: product deletion only blocks in-flight orders. Completed/cancelled historical `OrderItem.productId` rows still require a live `Product`, so hard delete can fail or break order history unless 1.34 lands first.

#### 1.34 — `OrderItem` snapshot enrichment
- Add `productSlug` and `imageUrl` snapshot fields so order history renders even after product deletion.

#### 1.35 — Inventory adjustment log
- New model `InventoryEntry { productId, delta, reason: SOLD|RETURNED|DAMAGED|RECOUNT|MANUAL, orderId?, actorUserId?, createdAt }`.
- Every `stock` change writes one entry. `Product.stock` becomes a derived/cached column reconciled from the entries.

#### 1.36 — Discount codes (basic)
- `Promotion { code @unique, type: PERCENT|FIXED, value, validFrom?, validUntil?, maxUses?, minSubtotalMinor? }`.
- Apply at checkout: `POST /cart/promotion { code }`. Snapshot on `Order` (`promotionCode`, `discountMinor`).

#### 1.37 — Returns / RMA flow
- `Return { id, orderId, status: REQUESTED|APPROVED|RECEIVED|REFUNDED|REJECTED, reason, createdAt }`.
- Admin approves → triggers refund flow from 1.4.

#### 1.38 — 3DS / SCA handling on web
- Detect `payment_intent.requires_action` and call `stripe.confirmCardPayment` / `handleNextAction` from the web side.
- Show "Verifying with your bank…" UI.

#### 1.39 — Search index
- Postgres `tsvector` column on `Product` (name + description), GIN index. `q` filter switches from `contains` to `to_tsquery`.

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
