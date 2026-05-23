# -- Build stage: compile Next.js with standalone output -----------------------
FROM node:20-alpine AS build
WORKDIR /app

# Install all workspace dependencies
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/web/package.json apps/web/
RUN npm ci

# Copy source
COPY tsconfig.base.json ./
COPY packages/shared/tsconfig.json packages/shared/src/ packages/shared/
COPY packages/db/tsconfig.json packages/db/src/ packages/db/
COPY apps/web/tsconfig.json apps/web/next.config.ts apps/web/postcss.config.mjs apps/web/
COPY apps/web/app/ apps/web/app/
COPY apps/web/components/ apps/web/components/
COPY apps/web/lib/ apps/web/lib/
COPY apps/web/hooks/ apps/web/hooks/
COPY apps/web/services/ apps/web/services/
COPY apps/web/constants/ apps/web/constants/
COPY apps/web/public/ apps/web/public/

# Build-time env vars (NEXT_PUBLIC_* are inlined at build)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_AUTH_COOKIE_NAME
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_AUTH_COOKIE_NAME=${NEXT_PUBLIC_AUTH_COOKIE_NAME}
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
ENV NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=${NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}

# Build workspace packages then Next.js
RUN npm run build -w packages/shared
RUN npm run build -w packages/db
RUN npm run build -w apps/web

# -- Production stage: standalone output, non-root user, health check ----------
FROM node:20-alpine AS prod
WORKDIR /app

# Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy standalone output (self-contained server + minimal node_modules)
COPY --from=build --chown=nodejs:nodejs /app/apps/web/.next/standalone ./

# Copy static assets (not bundled inside standalone)
COPY --from=build --chown=nodejs:nodejs /app/apps/web/.next/static ./.next/static
COPY --from=build --chown=nodejs:nodejs /app/apps/web/public ./public

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

USER nodejs

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/ || exit 1

CMD ["node", "server.js"]
