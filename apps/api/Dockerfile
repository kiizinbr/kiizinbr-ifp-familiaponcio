# syntax=docker/dockerfile:1.7
# Multi-stage Dockerfile para apps/api (NestJS 10) em monorepo pnpm.
# Usa pnpm deploy --prod para gerar pasta auto-suficiente.
# Build a partir da raiz do repo: docker build -f apps/api/Dockerfile -t ifp-api:latest .

# -------- Stage 1: dependências (com dev) --------
FROM node:20-alpine AS deps
RUN apk add --no-cache python3 make g++ libc6-compat \
    && corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/design-tokens/package.json ./packages/design-tokens/
COPY packages/ui/package.json ./packages/ui/

RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# -------- Stage 2: build --------
FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++ libc6-compat \
    && corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Schema do Prisma é externo ao apps/api — precisa estar gerado antes do build.
RUN pnpm db:generate
RUN pnpm --filter @ifp/api build

# Cria bundle auto-suficiente (apenas deps de produção) em /prod/api.
RUN pnpm --filter @ifp/api --prod deploy /prod/api

# -------- Stage 3a: migrator (uso pontual) --------
# Reaproveita o builder (que tem prisma CLI + schema) para rodar
# `prisma migrate deploy` em produção via docker-compose.
FROM builder AS migrator
ENV NODE_ENV=production
WORKDIR /app/packages/database
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

# -------- Stage 3: runner --------
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3333

RUN addgroup -S nodejs && adduser -S nestjs -G nodejs

# Bundle de produção (inclui dist + node_modules das deps de produção).
COPY --from=builder --chown=nestjs:nodejs /prod/api ./

USER nestjs
EXPOSE 3333

CMD ["node", "dist/main.js"]
