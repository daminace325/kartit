# ecomm-web

Next.js 16 (App Router) storefront. Talks to the Express API in `../api` via
the `/api/*` rewrite (browser) or directly via `NEXT_PUBLIC_API_URL` (server
components).

## Local development

From the **monorepo root** (`ecomm/`):

```bash
npm install              # installs all workspaces + links @repo/*
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
cp .env.example .env
docker compose up -d     # local Postgres
npm run db:migrate:dev   # run Prisma migrations
npm run dev              # starts web (3000) + api (5000) concurrently
```

Open http://localhost:3000.

## Environment variables

See [`.env.example`](./.env.example). All web-side vars are `NEXT_PUBLIC_*`
and are **inlined into the client bundle at build time** — they cannot be
changed at runtime. Set them in the Vercel dashboard before the first deploy.

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the Express API (e.g. `https://ecomm-api.onrender.com`). |
| `NEXT_PUBLIC_AUTH_COOKIE_NAME` | Must match `COOKIE_NAME` set on the API. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe `pk_live_...` / `pk_test_...`. |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary account; used by image URL builder. |

## Deploying to Vercel

This is a **monorepo**. In the Vercel project settings:

| Setting | Value |
|---|---|
| Framework Preset | Next.js |
| Root Directory | `apps/web` |
| Build Command | _leave default_ (`next build`) |
| Install Command | `cd ../.. && npm install` |
| Output Directory | _leave default_ (`.next`) |
| Node Version | 20.x |

The custom install command is required so npm picks up the workspace root
and links `@repo/shared` / `@repo/db` correctly. Without it Vercel would
only install inside `apps/web` and the `@repo/*` imports would fail.

### Cookies / cross-site auth

The browser calls `/api/*` (same-origin via `next.config.ts` rewrite) so the
API's httpOnly auth cookie lands on the Vercel origin and is automatically
re-sent. **Server components** that call the API directly use
`NEXT_PUBLIC_API_URL` and forward the cookie via the `Cookie` header
(handled in `lib/api.ts`).

For this to work in production the API must set:

```
COOKIE_SECURE=true
COOKIE_SAMESITE=none
WEB_ORIGINS=https://your-app.vercel.app
```

