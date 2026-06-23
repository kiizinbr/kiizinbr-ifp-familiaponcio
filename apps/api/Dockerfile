# syntax=docker/dockerfile:1.7
# apps/api (NestJS 10) — monorepo pnpm. Base Debian (Prisma openssl-3.0.x estável).
FROM node:20-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates && rm -rf /var/lib/apt/lists/* \
    && corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/design-tokens/package.json ./packages/design-tokens/
COPY packages/ui/package.json ./packages/ui/
RUN --mount=type=cache,id=pnpm-store-deb,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM node:20-bookworm-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates && rm -rf /var/lib/apt/lists/* \
    && corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app
COPY --from=deps /app/ ./
COPY . .
RUN pnpm db:generate
RUN pnpm --filter @ifp/database build
RUN pnpm --filter @ifp/api build
# Bundle de produção (só deps de prod — sem Next SWC/dev nativos musl).
# pnpm deploy NÃO inclui o client Prisma gerado (.prisma) → copiar manualmente
# do builder (onde já está com o engine debian-openssl-3.0.x).
RUN pnpm --filter @ifp/api --prod deploy /prod/api \
 && SRC=$(ls -d /app/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma 2>/dev/null | head -1) \
 && DST=$(ls -d /prod/api/node_modules/.pnpm/@prisma+client@*/node_modules 2>/dev/null | head -1) \
 && echo "copiando $SRC -> $DST/" \
 && cp -r "$SRC" "$DST/" \
 && ls "$DST/.prisma/client/" | grep -i engine && echo "OK prisma client no bundle"

FROM builder AS migrator
ENV NODE_ENV=production
WORKDIR /app/packages/database
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

FROM node:20-bookworm-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3333
RUN groupadd -r nodejs && useradd -r -g nodejs nestjs
COPY --from=builder --chown=nestjs:nodejs /prod/api ./
USER nestjs
EXPOSE 3333
CMD ["node", "dist/main.js"]
