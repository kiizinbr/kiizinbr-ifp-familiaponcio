# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# --- deps: instala todas as deps (com lockfile) ---
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# --- build: gera o Prisma Client + o build standalone do Next ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate
# env.ts valida process.env no import; o `next build` avalia os módulos de
# servidor ("collect page data") → precisa de valores VÁLIDOS de formato no
# build. São dummies de build-time; o runtime usa o env_file real (sobrescreve),
# e env de servidor não é "baked" — é lida do process.env em runtime.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    AUTH_SECRET="build_time_placeholder_secret_min_32_chars" \
    MINIO_ACCESS_KEY="build_time_placeholder" \
    MINIO_SECRET_KEY="build_time_placeholder"
RUN pnpm build

# --- runner: imagem enxuta com o servidor standalone ---
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
# server.js + node_modules mínimo (traçado pelo Next standalone)
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
