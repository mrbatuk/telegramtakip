# ============ Builder ============
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app

# Workspace dosyaları
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/

RUN pnpm install --frozen-lockfile

# Kaynak kod
COPY packages/db ./packages/db
COPY apps/api ./apps/api

# Prisma + build
RUN pnpm --filter @tt/db exec prisma generate
RUN pnpm --filter @tt/db build
RUN pnpm --filter @tt/api build

# ============ Runtime ============
FROM node:22-alpine AS runtime
RUN corepack enable && apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production

# Workspace + bağımlılıklar (sadece prod)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/db/prisma ./packages/db/prisma

RUN pnpm install --frozen-lockfile --prod
RUN pnpm --filter @tt/db exec prisma generate

# Build çıktıları
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist

# Uploads klasörü (R2 yoksa fallback)
RUN mkdir -p /app/uploads
VOLUME ["/app/uploads"]

EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
