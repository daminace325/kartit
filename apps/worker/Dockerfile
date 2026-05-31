# -- Build stage: compile TypeScript, build workspace packages -----------------
FROM node:20-alpine AS build
WORKDIR /app

# Install all workspace dependencies
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/worker/package.json apps/worker/
RUN npm ci

# Copy source
COPY tsconfig.base.json ./
COPY packages/shared/tsconfig.json packages/shared/src/ packages/shared/
COPY packages/db/tsconfig.json packages/db/src/ packages/db/prisma.config.ts packages/db/prisma/ packages/db/
COPY apps/worker/tsconfig.json apps/worker/src/ apps/worker/

# Build in dependency order (db build includes prisma generate)
RUN npm run build -w packages/shared
RUN npm run build -w packages/db
RUN npm run build -w apps/worker

# -- Production stage: slimmer runtime, non-root user --------------------------
FROM node:20-alpine AS prod
WORKDIR /app

# Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# node_modules
COPY --from=build --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/package.json /app/package-lock.json ./

# Built packages
COPY --from=build --chown=nodejs:nodejs /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build --chown=nodejs:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=nodejs:nodejs /app/packages/db/package.json ./packages/db/package.json
COPY --from=build --chown=nodejs:nodejs /app/packages/db/dist ./packages/db/dist
COPY --from=build --chown=nodejs:nodejs /app/packages/db/prisma ./packages/db/prisma
COPY --from=build --chown=nodejs:nodejs /app/packages/db/prisma.config.ts ./packages/db/prisma.config.ts

# Built worker
COPY --from=build --chown=nodejs:nodejs /app/apps/worker/dist ./apps/worker/dist
COPY --from=build --chown=nodejs:nodejs /app/apps/worker/package.json ./apps/worker/package.json

ENV NODE_ENV=production

USER nodejs

CMD ["node", "apps/worker/dist/index.js"]
