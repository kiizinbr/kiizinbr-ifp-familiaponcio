# syntax=docker/dockerfile:1.7
# Multi-stage Dockerfile para apps/web (Next.js 14 standalone) em monorepo pnpm.
# Build a partir da raiz do repo: docker build -f apps/web/Dockerfile -t ifp-web:latest .

# -------- Stage 1: dependências --------
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app

# Manifests primeiro pra aproveitar cache de camada do Docker.
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
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma Client precisa estar gerado antes do build do Next.
RUN pnpm db:generate
RUN pnpm --filter @ifp/web build

# -------- Stage 3: runner --------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Usuário não-root.
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Conteúdo do output standalone (já inclui node_modules tree-shaken).
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
