# 🧹 Mess Report — ecomm Monorepo

> **Audit date:** 2026-06-04
> **Last fix:** 2026-06-05 — C1 + C2 resolved
> **Scope:** apps/api, apps/web, apps/worker, packages/db, packages/shared (~196 source files)
> **Methodology:** Every claim was verified by direct file read, grep, or git inspection. No LLM assumptions.

---

## Severity scale

| Label | Meaning |
|-------|---------|
| 🔴 Critical | Could cause bugs in production, data corruption, or significant maintenance drag |
| 🟠 Warning | Duplication, inconsistency, or technical debt worth fixing soon |
| 🟡 Minor | Cleanliness issues — fix when touching the file, or as a dedicated cleanup PR |

---

## 🔴 CRITICAL

### ✅ C1. Worker duplicates all inventory + payment-handler logic from the API — **FIXED 2026-06-05**

**What was done:**
- `STOCK_HELD` and `STOCK_RELEASE` moved to `@repo/shared/src/enums.ts` — canonical constants, no Prisma dependency
- `restoreInventory` and `shipInventory` extracted to `packages/db/src/inventory.ts` — canonical functions, importable by both API and worker
- `orders.service.ts` now imports + re-exports from canonical sources (backward-compatible for `orders.payment.service.ts`)
- `webhooks-retry.worker.ts` imports `STOCK_HELD` from `@repo/shared` and `restoreInventory` from `@repo/db`; removed duplicated `STOCK_HELD` array
- Worker's raw `for` loops in `handlePaymentIntentFailed` and `handleChargeRefunded` replaced with calls to the canonical `restoreInventory(tx, items, wasShipped?)`

**Remaining duplication (acceptable):** The webhook handler orchestration logic (`handlePaymentIntentSucceeded`, `handlePaymentIntentFailed`, `handleChargeRefunded`) still exists in both the API (`orders.payment.service.ts`) and the worker. However, the critical inventory mutation path is now a single source of truth, so any bugfix to inventory release applies everywhere automatically. The handler duplication is stable orchestration code — low risk of divergence.

---

### ✅ C2. `orders.service.ts` — 600-line god file with 6 distinct concerns — **FIXED 2026-06-05**

**What was done:**
- **`orders.dto.ts`** (new, ~95 lines) — `generateOrderNumber`, `toItemDTO`, `toOrderDTO`, `ORDER_INCLUDE`, `ALLOWED_TRANSITIONS`, `OrderWithItems` type
- **`orders.inventory.service.ts`** (new, ~60 lines) — `reserveInventory` (canonical, with advisory locks); re-exports `STOCK_HELD`, `STOCK_RELEASE` from `@repo/shared` and `restoreInventory`, `shipInventory` from `@repo/db`
- **`orders.promotion-lock.ts`** (new, ~60 lines) — `lockPromotion` (advisory-lock-guarded promotion usage check)
- **`orders.service.ts`** (now ~270 lines, down from 600) — only `ordersService` CRUD facade (`create`, `list`, `getById`, `cancel`); re-exports from split modules for backward compat
- Consumers updated: `orders.payment.service.ts`, `orders.status.service.ts`, `sweepAbandonedOrders.ts`, `status-transitions.test.ts` now import from the specific canonical files

**Result:** Each file now has a single responsibility. The `create` method is still ~190 lines (cart validation + pricing + orchestration), but the sub-operations it composes (`reserveInventory`, `lockPromotion`, `toOrderDTO`) live in their own modules.

---

### C3. `idempotency.ts` — 543-line middleware with duplicated `res.json` patching and a subtle bug

**File:** `apps/api/src/middlewares/idempotency.ts` (543 lines)

This middleware houses: Redis SET NX claiming, Redis response caching, Postgres fallback with stale-row cleanup, a Redis health-check circuit breaker, and `res.json` monkey-patching for response interception.

**The `res.json` patch is copy-pasted twice:**
- Redis path: lines 395-414 (intercepts `res.json`, caches in Redis then updates Postgres fire-and-forget)
- Postgres fallback: lines 487-531 (intercepts `res.json`, awaits Postgres update then calls `originalJson`)

**Subtle bug in the Postgres path:** In the Redis path, the Postgres completion update is fire-and-forget (`void prisma.idempotencyKey.updateMany(...)`) — the HTTP response is sent immediately via `originalJson(body)`. In the Postgres fallback path (line 493-519), the code `await`s the `prisma.idempotencyKey.updateMany()` before calling `originalJson(body)`, and if the DB update fails it sends a 500 *instead* of the original successful response. This means:
1. The HTTP response is delayed by a DB write in the Postgres fallback path
2. A Postgres hiccup after a successful 2xx handler run turns a success into a 500 for the *current* request (the response was already computed successfully — the caching write failing shouldn't block the client)

**Fix:** Extract Redis path, Postgres path, and response-hooking into separate helper files. Unify the `res.json` patch into a single shared function. Make the Postgres fallback's completion write fire-and-forget, consistent with the Redis path.

---

## 🟠 WARNING

### W1. Promo code apply/remove logic duplicated across CartSummary and CheckoutClient

**Files:**
- `apps/web/components/CartSummary.tsx:23-72` (~50 lines)
- `apps/web/components/CheckoutClient.tsx:84-113` (~30 lines)

Both independently call `apiFetch<CartSummaryDTO>("/cart/summary", ...)` with the same `generationRef.current` race-condition guard, the same loading/error state management, and near-identical UI (input + Apply button, or applied promo with Remove button). Any change to the promo flow requires touching both components.

**Fix:** Extract a `usePromoCode()` hook that encapsulates the API call, loading/error state, and the `generationRef` race-condition guard. Both components import it.

---

### W2. Order summary breakdown duplicated 4 times

**Files:**
- `apps/web/components/CartSummary.tsx:82-145`
- `apps/web/components/CheckoutClient.tsx:331-384`
- `apps/web/app/(public)/orders/[id]/page.tsx:294-354`
- `apps/web/app/admin/orders/[id]/page.tsx:220-286`

Each renders an identical `<dl>` grid: Subtotal → Discount (conditional, with `BigInt() > 0n` check) → Shipping (with "Free" fallback when zero) → Tax (with "—" fallback when zero) → separator → Total. Same `formatMoney()` calls, same `BigInt()` checks, same note-rendering pattern. ~60-80 lines of JSX each.

**Fix:** Create a shared `<OrderSummaryBreakdown>` component accepting `{ subtotalMinor, discountMinor, discountNote, shippingMinor, shippingNote, taxMinor, taxNote, totalMinor, currency, promotionCode? }` as props.

---

### W3. Order item rows duplicated 4 times

**Files:**
- `apps/web/components/CheckoutClient.tsx:124-152`
- `apps/web/app/(public)/orders/[id]/page.tsx:231-268`
- `apps/web/app/admin/orders/[id]/page.tsx:133-173`
- `apps/web/app/(public)/orders/[id]/pay/page.tsx:179-187` (simpler variant)

Same pattern: product thumbnail (with `eslint-disable-next-line @next/next/no-img-element`), product name link, qty × unit price, line total. Same styling, same layout.

**Fix:** Extract `<OrderItemRow>` component.

---

### W4. Shipping address display duplicated 3 times

**Files:**
- `apps/web/components/CheckoutClient.tsx:200-213`
- `apps/web/app/(public)/orders/[id]/page.tsx:276-287`
- `apps/web/app/admin/orders/[id]/page.tsx:202-214`

Identical rendering: `shippingName` (bold), `shippingPhone`, `shippingLine1`, `shippingLine2` (conditional), `shippingCity, shippingState shippingPostalCode`, `shippingCountry`.

**Fix:** Extract `<AddressDisplay address={...}>` component.

---

### W5. `REFUND_WINDOW_DAYS = 7` defined in both API and web

**Files:**
- `apps/api/src/modules/orders/orders.refund-request.service.ts:5`
- `apps/web/app/(public)/orders/[id]/page.tsx:28`

Both independently define the refund window constant AND independently compute the deadline (`deliveredAt + 7 days`). If the business changes the refund window, both must be found and updated. The web's calculation could diverge from the server's enforcement, causing confusing UX where the UI shows a "Request Refund" button but the server rejects it.

**Fix:** Export `REFUND_WINDOW_DAYS` from `@repo/shared`. Import it in both files.

---

### W6. `userIdOrThrow` duplicated in 5 controllers

**Files:** `cart.controller.ts:7`, `addresses.controller.ts:6`, `auth.controller.ts:7`, `orders.controller.ts:15`, `promotions.controller.ts:7`

Exact same 4-line function in every controller:
```typescript
function userIdOrThrow(req: Parameters<RequestHandler>[0]): string {
    const id = req.user?.id;
    if (!id) throw AppError.unauthorized();
    return id;
}
```

**Fix:** Move to `apps/api/src/lib/request.ts` and import everywhere.

---

### W7. Dead code: `promotionValidateSchema` + `PromotionValidateInput`

**File:** `packages/shared/src/schemas/promotion.ts:29-32`

```typescript
const promotionValidateSchema = z.object({
    code: z.string().min(1),
});
type PromotionValidateInput = z.infer<typeof promotionValidateSchema>;
```

Neither is exported. Neither is used anywhere in the codebase (verified with project-wide grep). Dead since creation.

**Fix:** Delete lines 29-32.

---

### W8. Dead code: `buildOutboxEntry` exported but never called

**File:** `apps/worker/src/outbox-dispatcher.ts:155-167`

The function is documented with a usage example, exported, but grep returns zero call sites across the entire codebase. All outbox rows are created inline with raw `tx.outbox.create({ data: {...} })` in the API service files.

**Fix:** Either refactor the inline `tx.outbox.create` calls to use `buildOutboxEntry`, or remove the dead helper.

---

### W9. Stripe SDK and API version mismatch between API and worker

| | API | Worker |
|---|---|---|
| **SDK version** | `^18.5.0` | `^22.2.0` |
| **API version pinned** | `"2025-08-27.basil"` | `"2026-05-27.dahlia"` |

`apps/api/src/lib/stripe.ts:18` pins `2025-08-27.basil`. `apps/worker/src/lib/stripe.ts:14` pins `2026-05-27.dahlia` — a completely different Stripe API version. The `dahlia` version may not be available in SDK v18. If both services ever touch the same Stripe resource (e.g., the API creates a PaymentIntent and the worker refunds it), behavioral differences are guaranteed.

Additionally, **argon2** is `^0.41.1` in `packages/db/package.json` but `^0.44.0` in `apps/api/package.json`. npm could install two different versions side-by-side.

**Fix:** Bump API to `stripe@^22.2.0`, pin both to the same API version. Align argon2 ranges to the same version.

---

### W10. Unused `@repo/db` dependency in `apps/web`

**File:** `apps/web/package.json`

`"@repo/db": "*"` is listed as a dependency, but grep for `from "@repo/db"` across the entire `apps/web/` directory returns **zero** files. The web app exclusively uses `@repo/shared` for types and utilities. This dependency pulls Prisma, the PrismaPg adapter, and all generated Prisma types into the web app's install tree needlessly — increasing install time and bundle tracing overhead.

**Fix:** Remove `@repo/db` from `apps/web/package.json`.

---

### W11. `@ts-expect-error` masking unsafe `catch` variable access

**File:** `apps/web/app/admin/promotions/PromotionForm.tsx` (~line 99)

```typescript
// @ts-expect-error err is unknown from catch
setError(err.message ?? "Invalid value");
```

If something other than an `Error` is thrown (e.g., `throw "validation failed"`), `err.message` is `undefined`, and the UI silently shows "Invalid value" instead of the actual error. The `@ts-expect-error` suppresses the TypeScript safety that would have caught this.

**Fix:** Use a proper type guard:
```typescript
setError(err instanceof Error ? err.message : String(err));
```

---

### W12. Worker services use `console.log` instead of structured logging

**Files:**
- `apps/worker/src/workers/webhooks-retry.worker.ts` (18× console calls)
- `apps/worker/src/workers/order-events.worker.ts` (5× console calls)
- `apps/worker/src/outbox-dispatcher.ts` (6× console calls)

Meanwhile, the API already has a `logger.ts` wrapper (console-based, but centralised, with the comment "P2.10 → pino"). The worker has no equivalent — raw `console.log`/`console.error`/`console.warn` scattered across files. The outbox-dispatcher even has a comment: *"P2.10 will wire to pino"*.

**Fix:** Add a `logger.ts` to `apps/worker/src/lib/` matching the API's pattern. Replace all `console.*` calls in workers and the dispatcher.

---

## 🟡 MINOR

### M1. `Category` type locally defined 10 times — with inconsistent shapes

**Files and the fields they define:**

| File | Fields |
|------|--------|
| `components/Navbar.tsx:8` | `id, slug, name` |
| `app/(public)/page.tsx:6` | `id, slug, name, parentId` |
| `app/(public)/c/[slug]/page.tsx:7` | `id, slug, name, parentId` |
| `app/(public)/p/[slug]/page.tsx:11` | `id, slug, name` |
| `app/admin/page.tsx:8` | `id, slug, name` |
| `app/admin/categories/page.tsx:8` | `id, slug, name, parentId, isActive` |
| `app/admin/categories/new/page.tsx:8` | `id, slug, name, parentId` |
| `app/admin/categories/[id]/edit/page.tsx:9` | `id, slug, name, parentId, isActive` |
| `app/admin/products/new/page.tsx:8` | `id, slug, name` |
| `app/admin/products/[id]/edit/page.tsx:10` | `id, slug, name` |

This is worse than just duplication — the shapes are **not all the same**. Some include `parentId`, some include `isActive`, some include both, some include neither. A page that accesses `.parentId` on a shape that omitted it would pass type checking locally but is logically wrong (the field is missing from the API response that populates it).

**Fix:** Define a single `CategoryDTO` type in `@repo/shared` (or a local `apps/web/types.ts`) and import everywhere. The shared package already has `CategoryDTO` in `schemas/category.ts` — use it.

---

### M2. `ProductList` type locally defined 5 times

**Files:** `(public)/page.tsx:7`, `(public)/c/[slug]/page.tsx:8`, `(public)/search/page.tsx:6`, `admin/products/page.tsx:10`, `admin/page.tsx:9`

All 5 have the identical shape `{ items: ProductDTO[]; nextCursor: string | null }`.

**Fix:** Define once in a shared types file, or use the shared package's response type.

---

### M3. Cursor-based "Load more" pagination duplicated in 6 list pages

Every list page (`(public)/c/[slug]`, `(public)/search`, `(public)/orders`, `admin/orders`, `admin/refund-requests`, `admin/ledger`) implements the same "Load more" link pattern with the same `nextCursor` prop drilling and `searchParams` merging.

**Fix:** Extract `<CursorPagination nextCursor={...} />` component.

---

### M4. Error boundary pages are 4 near-identical copies

**Files:** `app/error.tsx`, `app/(public)/error.tsx`, `app/(auth)/error.tsx`, `app/admin/error.tsx`

All four follow the same structure: `"use client"` → `useEffect(() => console.error(error), [error])` → error message → optional `error.digest` → reset button → home/dashboard link. Only the title text and the home-link destination differ.

**Fix:** Create a shared `<ErrorPage>` component parameterized by `title`, `homeHref`, and `homeLabel`. Each route group's `error.tsx` becomes a thin wrapper.

---

### M5. `deleteImageSchema` + `DeleteImageInput` exported from shared but never used by web

**File:** `packages/shared/src/schemas/image.ts` — exported via barrel, but zero imports in `apps/web/`

The web app's `ProductForm.tsx` sends raw `{ publicId }` JSON to `DELETE /images` without using the shared schema type. The API validates it with the schema on the server side, but the web loses type safety.

**Fix:** Import and use `DeleteImageInput` in `ProductForm.tsx` for the delete call.

---

### M6. `PaymentStatus` enum exported from shared but never imported in web

**File:** `packages/shared/src/enums.ts` — `PaymentStatus` (both const object and type) is exported via the shared barrel, but zero files in `apps/web/` import it. It's only used in `apps/api` and `apps/worker`.

Not harmful, but adds noise to the web app's auto-import suggestions.

**Fix:** Either accept as is (no real cost) or split enums into client-safe and server-only exports.

---

### M7. `parseMoney` exported but only consumed in unit tests

**File:** `packages/shared/src/money.ts:62` — `parseMoney` is in the public API surface but has **zero** production consumers. It only appears in `apps/api/test/unit/money.test.ts`. The web app uses `majorToMinor` for user input parsing instead.

**Fix:** Either remove from the public export (keep internal for tests), or mark with a comment that it's available for future use.

---

### M8. Three empty directories as dead scaffolding

- `apps/api/src/modules/inventory/` — 0 files
- `apps/api/src/modules/returns/` — 0 files
- `apps/web/app/admin/returns/` — 0 files

None of these are referenced in route registration (`app.ts` or Next.js layout). They exist as placeholders from the original module stubbing.

**Fix:** Either implement the modules or delete the empty directories.

---

### M9. Router-level vs route-level `requireAuth` inconsistency

`ordersRouter` applies auth at the router level:
```typescript
ordersRouter.use(requireAuth);  // applies to all routes
```

`productsRouter` applies auth per-route:
```typescript
productsRouter.post("/", requireAuth, requireAdmin, ...);
productsRouter.put("/:id", requireAuth, requireAdmin, ...);
```

Both patterns work, but a developer adding a route to the orders router might not realize auth is already applied (and might add a redundant `requireAuth`), while a developer adding a route to the products router might forget to add auth guards.

**Fix:** Pick one pattern and standardize. Router-level `use(requireAuth)` with `requireAdmin` on individual admin routes is cleaner for modules where all routes are authenticated.

---

### M10. Cursor pagination limit validation is inconsistent across endpoints

In `orders.controller.ts:107-108`, the `limit` parameter is parsed and clamped:
```typescript
const limitRaw = parseInt(query.limit as string, 10);
const limit = !isNaN(limitRaw) ? Math.min(limitRaw, 50) : undefined;
```

Other list endpoints pass `limit` as a raw string to the service, relying on the service to handle garbage values — but not all services validate it. The `refundRequestService.list()` does `limit = 20` default but doesn't clamp. The `ordersService.list()` doesn't validate at all.

**Fix:** Add consistent `limit` parsing/validation in either a shared controller helper or in the shared query schema.

---

### M11. "Load more" pagination pattern visually inconsistent

Some pages use `cursor` as a query param, others use `nextCursor`. Both work because the API accepts `cursor`, but the naming inconsistency between server-side API params and client-side pagination state is confusing.

---

## ✅ Things checked and confirmed clean

These were investigated and found to be fine:

- **`dist/` is NOT tracked in git** — `.gitignore` has `dist/` and `git ls-files */dist/*` returns zero tracked files. The initial exploration agent hallucinated this.
- **No circular dependencies** — the import graph across all workspaces is a clean DAG: `shared` ← `db` ← `api`/`worker`/`web`. API cross-module imports are one-directional.
- **Controllers are properly thin** — all 12 API modules follow the same pattern: extract params → call service → return response. No business logic in controllers.
- **Server-authoritative pricing** — `orders.service.ts:317` recalculates all pricing server-side from cart items. Never trusts client totals.
- **Proper advisory-lock concurrency control** on inventory reservation — `pg_advisory_xact_lock` with product-ID-sorted locking to prevent deadlocks. Validated by a k6 test (200 VUs → exactly 10 orders from 10 stock).
- **Outbox pattern** is correctly implemented — rows are created in the same `$transaction` as business state changes for atomicity, with at-least-once delivery via the dispatcher.
- **No `TODO`/`FIXME`/`HACK` litter** — the codebase is professionally maintained.
- **No leftover debug `console.log` in web or API** — the API uses a centralised `logger.ts` wrapper. Workers use raw `console.*` (noted as W12).

---

## Summary table

| # | Severity | Issue | Files affected |
|---|----------|-------|----------------|
| C1 | ✅ Fixed | Worker copies inventory + payment logic from API | Fixed 2026-06-05 — inventory helpers extracted to @repo/db & @repo/shared |
| C2 | ✅ Fixed | 600-line god file mixing 6 concerns | Fixed 2026-06-05 — split into 4 single-responsibility files |
| C3 | 🔴 Critical | 543-line middleware; duplicated res.json patch; slow-path bug | `idempotency.ts` |
| W1 | 🟠 Warning | Promo code logic duplicated | `CartSummary.tsx`, `CheckoutClient.tsx` |
| W2 | 🟠 Warning | Order summary breakdown duplicated 4× | 4 files |
| W3 | 🟠 Warning | Order item rows duplicated 4× | 4 files |
| W4 | 🟠 Warning | Address display duplicated 3× | 3 files |
| W5 | 🟠 Warning | `REFUND_WINDOW_DAYS` duplicated API ↔ web | 2 files |
| W6 | 🟠 Warning | `userIdOrThrow` duplicated in 5 controllers | 5 files |
| W7 | 🟠 Warning | Dead code: `promotionValidateSchema` | `promotion.ts` |
| W8 | 🟠 Warning | Dead code: `buildOutboxEntry` never called | `outbox-dispatcher.ts` |
| W9 | 🟠 Warning | Stripe SDK v18 vs v22 + API version mismatch | `api/package.json`, `worker/package.json` |
| W10 | 🟠 Warning | Unused `@repo/db` dep in web | `web/package.json` |
| W11 | 🟠 Warning | `@ts-expect-error` on unsafe catch access | `PromotionForm.tsx` |
| W12 | 🟠 Warning | Worker uses `console.log` instead of structured logger | 3 worker files |
| M1 | 🟡 Minor | `Category` type defined 10× with inconsistent shapes | 10 files |
| M2 | 🟡 Minor | `ProductList` type defined 5× | 5 files |
| M3 | 🟡 Minor | Cursor pagination duplicated 6× | 6 list pages |
| M4 | 🟡 Minor | Error boundaries 4 near-identical copies | 4 files |
| M5 | 🟡 Minor | `deleteImageSchema` exported but unused by web | `image.ts` |
| M6 | 🟡 Minor | `PaymentStatus` unused by web | `enums.ts` |
| M7 | 🟡 Minor | `parseMoney` only used in tests | `money.ts` |
| M8 | 🟡 Minor | 3 empty directories | `inventory/`, `returns/` (2×) |
| M9 | 🟡 Minor | Inconsistent auth middleware application pattern | routes files |
| M10 | 🟡 Minor | Inconsistent pagination limit validation | controllers |
| M11 | 🟡 Minor | Cursor param naming inconsistency | web pagination |
