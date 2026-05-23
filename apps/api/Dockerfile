# -- Build stage: compile TypeScript, build workspace packages -----------------
FROM node:20-alpine AS build
WORKDIR /app

# Native module build toolchain (argon2)
RUN apk add --no-cache python3 make g++

# Install all workspace dependencies
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
RUN npm ci

# Copy source
COPY tsconfig.base.json ./
COPY packages/shared/tsconfig.json packages/shared/src/ packages/shared/
COPY packages/db/tsconfig.json packages/db/src/ packages/db/prisma.config.ts packages/db/prisma/ packages/db/
COPY apps/api/tsconfig.json apps/api/src/ apps/api/

# Build in dependency order (db build includes prisma generate)
RUN npm run build -w packages/shared
RUN npm run build -w packages/db
RUN npm run build -w apps/api

# -- Production stage: slimmer runtime, non-root user, health check ------------
FROM node:20-alpine AS prod
WORKDIR /app

# Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# node_modules (includes prisma CLI for migrate deploy at startup)
COPY --from=build --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/package.json /app/package-lock.json ./

# Built packages
COPY --from=build --chown=nodejs:nodejs /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build --chown=nodejs:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=nodejs:nodejs /app/packages/db/package.json ./packages/db/package.json
COPY --from=build --chown=nodejs:nodejs /app/packages/db/dist ./packages/db/dist
COPY --from=build --chown=nodejs:nodejs /app/packages/db/prisma ./packages/db/prisma
COPY --from=build --chown=nodejs:nodejs /app/packages/db/prisma.config.ts ./packages/db/prisma.config.ts

# Built API
COPY --from=build --chown=nodejs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=nodejs:nodejs /app/apps/api/package.json ./apps/api/package.json

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

USER nodejs

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:${PORT:-5000}/health/live || exit 1

CMD ["sh", "-c", "npm run db:migrate:deploy && npm run db:seed && node apps/api/dist/server.js"]
