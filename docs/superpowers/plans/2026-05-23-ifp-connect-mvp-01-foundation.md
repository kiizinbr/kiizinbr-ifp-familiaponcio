# IFP Connect MVP — Plano 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estabelecer a fundação técnica do IFP Connect — repo limpo, Next.js 16 com TypeScript estrito, PostgreSQL 16 com Prisma, Auth.js v5 esqueleto, Docker Compose para dev local, e CI verde no GitHub Actions — entregando um app "Hello IFP" que faz login básico, lê do banco e passa nos checks de CI.

**Architecture:** Modular monolith em Next.js 16 (App Router, Server Actions). PostgreSQL 16 rodando em container Docker no dev. Prisma como ORM com migrations versionadas. Auth.js v5 com adapter Prisma. shadcn/ui inicializado para uso futuro. Toda configuração via variáveis de ambiente (12-factor). CI via GitHub Actions roda lint + typecheck + testes a cada PR.

**Tech Stack:** Node.js 20 LTS, pnpm 9, Next.js 16, TypeScript 5 estrito, PostgreSQL 16, Prisma 5, Auth.js v5, Tailwind CSS 4, shadcn/ui, Vitest, Playwright, Docker + Docker Compose, GitHub Actions.

**Spec base:** `docs/superpowers/specs/2026-05-23-ifp-connect-mvp-design.md`

---

## File Structure (criado neste plano)

```
ifp-connect/
├── .github/
│   └── workflows/
│       └── ci.yml                        # lint + typecheck + test
├── .dockerignore
├── .editorconfig
├── .env.example                          # template de env (commitado)
├── .env.local                            # dev real (gitignored)
├── .gitignore
├── .nvmrc                                # node 20
├── README.md                             # bootstrap + comandos
├── docker-compose.dev.yml                # postgres + minio para dev
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json                         # strict: true
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── components.json                       # shadcn/ui config
├── eslint.config.mjs
├── prettier.config.mjs
├── vitest.config.ts
├── playwright.config.ts
├── prisma/
│   ├── schema.prisma                     # User + Account + Session (Auth.js)
│   └── migrations/                       # gerado pelo Prisma
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # root layout com providers
│   │   ├── page.tsx                      # "Hello IFP" + status do DB
│   │   ├── globals.css                   # tokens IFP + tailwind base
│   │   ├── (auth)/
│   │   │   └── login/page.tsx            # tela de login (Credentials)
│   │   └── api/
│   │       └── auth/[...nextauth]/route.ts
│   ├── lib/
│   │   ├── auth.ts                       # configuração Auth.js v5
│   │   ├── db.ts                         # cliente Prisma singleton
│   │   └── env.ts                        # parse seguro de env com Zod
│   └── components/
│       └── ui/                           # shadcn (vazio agora)
└── tests/
    ├── unit/
    │   └── env.test.ts                   # smoke test de env
    └── e2e/
        └── login.spec.ts                 # playwright: login funciona
```

---

## Task 1: Inicializar repositório e configuração base do Node

**Files:**

- Create: `.gitignore`
- Create: `.nvmrc`
- Create: `.editorconfig`
- Create: `README.md`

- [ ] **Step 1: Verificar versão do Node (deve ser 20.x)**

Run: `node --version`
Expected: `v20.x.x` (qualquer 20.x serve)

Se não tiver, instalar Node 20 LTS antes de continuar.

- [ ] **Step 2: Criar `.nvmrc`**

```
20
```

- [ ] **Step 3: Criar `.editorconfig`**

```
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 4: Criar `.gitignore`**

```
# deps
node_modules/
.pnpm-store/

# next.js
.next/
out/
build/
dist/

# env
.env
.env.local
.env*.local

# tests
coverage/
playwright-report/
playwright/.cache/
test-results/

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db
desktop.ini

# logs
*.log
npm-debug.log*
pnpm-debug.log*

# Docker volumes locais
.data/

# superpowers brainstorm artifacts (visual companion files)
.superpowers/
```

- [ ] **Step 5: Criar `README.md`**

````markdown
# IFP Connect

Plataforma única para operação do Instituto Família Pôncio (IFP) — Núcleo Transversal (Ficha Cidadã, Triagem Social, RBAC, LGPD).

## Stack

Next.js 16 · TypeScript · Tailwind · shadcn/ui · Prisma · PostgreSQL 16 (RLS) · Auth.js v5 · Docker

## Setup local

```bash
# 1. Pré-requisitos
node --version   # 20.x
pnpm --version   # 9.x
docker --version

# 2. Instalar deps
pnpm install

# 3. Subir banco + storage de dev
docker compose -f docker-compose.dev.yml up -d

# 4. Copiar env
cp .env.example .env.local
# editar .env.local com segredos

# 5. Migrations do banco
pnpm prisma migrate dev

# 6. Rodar dev server
pnpm dev
```
````

App em http://localhost:3000.

## Comandos

- `pnpm dev` — Next.js em modo dev
- `pnpm build` — build de produção
- `pnpm test` — Vitest (unit)
- `pnpm test:e2e` — Playwright (e2e)
- `pnpm lint` — ESLint
- `pnpm typecheck` — TypeScript estrito

## Documentação

- Spec do MVP: `docs/superpowers/specs/2026-05-23-ifp-connect-mvp-design.md`
- Planos de implementação: `docs/superpowers/plans/`

````

- [ ] **Step 6: Commit**

```bash
git add .gitignore .nvmrc .editorconfig README.md
git commit -m "chore: bootstrap repo base (gitignore, nvmrc, editorconfig, readme)"
````

---

## Task 2: Instalar e configurar pnpm + workspace TS

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`

- [ ] **Step 1: Verificar pnpm instalado (versão 9.x)**

Run: `pnpm --version`
Expected: `9.x.x`

Se não tiver: `npm install -g pnpm@9`

- [ ] **Step 2: Criar `package.json` inicial**

```json
{
  "name": "ifp-connect",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20",
    "pnpm": ">=9"
  },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "db:seed": "tsx prisma/seed.ts"
  }
}
```

- [ ] **Step 3: Criar `tsconfig.json` com strict ligado**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json tsconfig.json
git commit -m "chore: pnpm + typescript strict config"
```

---

## Task 3: Bootstrap Next.js 16

**Files:**

- Modify: `package.json` (adicionar deps Next/React)
- Create: `next.config.ts`
- Create: `next-env.d.ts` (auto-gerado pelo Next)
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`

- [ ] **Step 1: Instalar Next.js 16 + React 19**

Run:

```bash
pnpm add next@latest react@latest react-dom@latest
pnpm add -D @types/node @types/react @types/react-dom typescript
```

Expected: install sem erros, `next` aparece em `dependencies`.

- [ ] **Step 2: Criar `next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
```

- [ ] **Step 3: Criar `src/app/globals.css` (Tailwind + tokens IFP)**

```css
@import "tailwindcss";

:root {
  /* IFP brand tokens (do brandbook) */
  --ifp-medico: 16 194 187; /* #10C2BB teal */
  --ifp-capacitacao: 255 119 46; /* #FF772E laranja */
  --ifp-esportivo: 117 44 5; /* #752C05 terracota */
  --ifp-educacional: 0 117 113; /* #007571 teal escuro */
  --ifp-social: 30 64 175; /* #1E40AF azul institucional */
}
```

- [ ] **Step 4: Criar `src/app/layout.tsx`**

```typescript
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IFP Connect",
  description: "Plataforma do Instituto Família Pôncio",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Criar `src/app/page.tsx`**

```typescript
export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <h1 className="text-3xl font-semibold">Hello IFP</h1>
    </main>
  );
}
```

- [ ] **Step 6: Rodar dev server e validar**

Run: `pnpm dev`
Expected: app sobe em http://localhost:3000 e mostra "Hello IFP".

Encerrar com Ctrl+C depois de validar visualmente.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml next.config.ts next-env.d.ts src/
git commit -m "feat: bootstrap next.js 16 app router com hello ifp"
```

---

## Task 4: Configurar Tailwind CSS 4 + shadcn/ui (vazio)

**Files:**

- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `components.json`
- Modify: `package.json`

- [ ] **Step 1: Instalar Tailwind 4**

Run:

```bash
pnpm add -D tailwindcss @tailwindcss/postcss postcss
```

- [ ] **Step 2: Criar `postcss.config.mjs`**

```javascript
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

- [ ] **Step 3: Criar `tailwind.config.ts`**

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ifp: {
          medico: "rgb(var(--ifp-medico) / <alpha-value>)",
          capacitacao: "rgb(var(--ifp-capacitacao) / <alpha-value>)",
          esportivo: "rgb(var(--ifp-esportivo) / <alpha-value>)",
          educacional: "rgb(var(--ifp-educacional) / <alpha-value>)",
          social: "rgb(var(--ifp-social) / <alpha-value>)",
        },
      },
    },
  },
};

export default config;
```

- [ ] **Step 4: Inicializar shadcn/ui**

Run: `pnpm dlx shadcn@latest init`

Responder:

- Style: New York
- Base color: Slate
- CSS variables: Yes

Resultado esperado: cria `components.json` e ajusta `globals.css`.

- [ ] **Step 5: Validar build**

Run: `pnpm build`
Expected: build conclui sem erros.

- [ ] **Step 6: Commit**

```bash
git add postcss.config.mjs tailwind.config.ts components.json src/app/globals.css package.json pnpm-lock.yaml
git commit -m "feat: tailwind 4 + shadcn ui inicializado"
```

---

## Task 5: Variáveis de ambiente com validação Zod

**Files:**

- Create: `.env.example`
- Create: `.env.local`
- Create: `src/lib/env.ts`
- Create: `tests/unit/env.test.ts`

- [ ] **Step 1: Instalar Zod**

Run: `pnpm add zod`

- [ ] **Step 2: Criar `src/lib/env.ts`**

```typescript
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET deve ter ao menos 32 caracteres"),
  AUTH_URL: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Env inválido:", parsed.error.flatten().fieldErrors);
  throw new Error("Variáveis de ambiente inválidas. Cheque .env.local");
}

export const env = parsed.data;
```

- [ ] **Step 3: Criar `.env.example`**

```
NODE_ENV=development
DATABASE_URL=postgresql://ifp:ifp_dev_pw@localhost:5432/ifp_connect
AUTH_SECRET=cole-aqui-uma-string-aleatoria-de-pelo-menos-32-caracteres
AUTH_URL=http://localhost:3000
```

- [ ] **Step 4: Criar `.env.local` (gitignored)**

Gerar AUTH_SECRET aleatório:
Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Copiar output para `.env.local`:

```
NODE_ENV=development
DATABASE_URL=postgresql://ifp:ifp_dev_pw@localhost:5432/ifp_connect
AUTH_SECRET=<output_do_comando_acima>
AUTH_URL=http://localhost:3000
```

- [ ] **Step 5: Escrever teste failing pra validação**

Instalar Vitest: `pnpm add -D vitest @vitest/coverage-v8`

Criar `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

Criar `tests/unit/env.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { z } from "zod";

// Mesmo schema do src/lib/env.ts — duplicado intencionalmente
// pra testar sem importar process.env real
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().url().optional(),
});

describe("env schema", () => {
  it("aceita config válida", () => {
    const result = envSchema.parse({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://x:y@localhost:5432/z",
      AUTH_SECRET: "a".repeat(32),
    });
    expect(result.DATABASE_URL).toContain("postgresql");
  });

  it("rejeita AUTH_SECRET curto", () => {
    expect(() =>
      envSchema.parse({
        DATABASE_URL: "postgresql://x:y@localhost:5432/z",
        AUTH_SECRET: "curto",
      }),
    ).toThrow();
  });

  it("rejeita DATABASE_URL inválida", () => {
    expect(() =>
      envSchema.parse({
        DATABASE_URL: "not-a-url",
        AUTH_SECRET: "a".repeat(32),
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 6: Rodar testes e validar passam**

Run: `pnpm test`
Expected: 3 testes passam.

- [ ] **Step 7: Commit**

```bash
git add .env.example src/lib/env.ts tests/ vitest.config.ts package.json pnpm-lock.yaml
git commit -m "feat: env validation com zod + vitest setup"
```

---

## Task 6: Docker Compose para Postgres + MinIO

**Files:**

- Create: `docker-compose.dev.yml`
- Create: `.dockerignore`

- [ ] **Step 1: Criar `.dockerignore`**

```
node_modules
.next
.git
.env
.env.local
*.log
coverage
playwright-report
test-results
.superpowers
```

- [ ] **Step 2: Criar `docker-compose.dev.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: ifp_postgres_dev
    environment:
      POSTGRES_USER: ifp
      POSTGRES_PASSWORD: ifp_dev_pw
      POSTGRES_DB: ifp_connect
    ports:
      - "5432:5432"
    volumes:
      - ./.data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ifp -d ifp_connect"]
      interval: 5s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    container_name: ifp_minio_dev
    environment:
      MINIO_ROOT_USER: ifp_minio
      MINIO_ROOT_PASSWORD: ifp_minio_dev_pw
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - ./.data/minio:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5
```

- [ ] **Step 3: Subir os containers**

Run: `docker compose -f docker-compose.dev.yml up -d`
Expected: dois containers `Up` em `docker ps`.

- [ ] **Step 4: Validar Postgres responde**

Run: `docker exec ifp_postgres_dev pg_isready -U ifp -d ifp_connect`
Expected: `accepting connections`

- [ ] **Step 5: Validar MinIO console**

Abrir browser em http://localhost:9001
Login: ifp_minio / ifp_minio_dev_pw
Expected: console MinIO carrega.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.dev.yml .dockerignore
git commit -m "feat: docker compose dev (postgres 16 + minio)"
```

---

## Task 7: Prisma + schema inicial (Auth.js v5 models)

**Files:**

- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`

- [ ] **Step 1: Instalar Prisma**

Run:

```bash
pnpm add @prisma/client
pnpm add -D prisma
```

- [ ] **Step 2: Criar `prisma/schema.prisma` (apenas tabelas Auth.js v5 por agora)**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?
  name          String?
  image         String?
  accounts      Account[]
  sessions      Session[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

- [ ] **Step 3: Rodar primeira migration**

Run: `pnpm prisma migrate dev --name init_auth`
Expected: cria `prisma/migrations/<timestamp>_init_auth/` e aplica no banco.

- [ ] **Step 4: Criar cliente Prisma singleton em `src/lib/db.ts`**

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
```

- [ ] **Step 5: Validar typecheck**

Run: `pnpm typecheck`
Expected: zero erros.

- [ ] **Step 6: Commit**

```bash
git add prisma/ src/lib/db.ts package.json pnpm-lock.yaml
git commit -m "feat: prisma + schema inicial auth.js"
```

---

## Task 8: Auth.js v5 com Credentials provider mínimo

**Files:**

- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/middleware.ts`
- Create: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Instalar Auth.js v5 + adapter Prisma + bcrypt**

Run:

```bash
pnpm add next-auth@beta @auth/prisma-adapter bcryptjs
pnpm add -D @types/bcryptjs
```

- [ ] **Step 2: Adicionar campo `hashedPassword` ao User**

Editar `prisma/schema.prisma`, no model User adicionar:

```prisma
model User {
  id             String    @id @default(cuid())
  email          String    @unique
  emailVerified  DateTime?
  hashedPassword String?
  name           String?
  image          String?
  accounts       Account[]
  sessions       Session[]
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
}
```

Rodar: `pnpm prisma migrate dev --name add_hashed_password`

- [ ] **Step 3: Criar `src/lib/auth.ts`**

```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user?.hashedPassword) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.hashedPassword);
        if (!ok) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
});
```

- [ ] **Step 4: Criar `src/app/api/auth/[...nextauth]/route.ts`**

```typescript
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 5: Criar `src/middleware.ts` (esqueleto)**

```typescript
import { auth } from "@/lib/auth";

export default auth((req) => {
  // RBAC virá no Plano 2. Por agora apenas exige sessão para rotas /app/*.
  const isAuthRoute = req.nextUrl.pathname.startsWith("/login");
  const isApp = req.nextUrl.pathname.startsWith("/app");

  if (isApp && !req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/app/:path*"],
};
```

- [ ] **Step 6: Criar `src/app/(auth)/login/page.tsx`**

```typescript
import { signIn } from "@/lib/auth";

export default function LoginPage() {
  return (
    <main className="min-h-screen grid place-items-center bg-slate-50">
      <form
        action={async (formData) => {
          "use server";
          await signIn("credentials", {
            email: formData.get("email"),
            password: formData.get("password"),
            redirectTo: "/app",
          });
        }}
        className="w-full max-w-sm bg-white p-8 rounded-xl shadow"
      >
        <h1 className="text-2xl font-semibold mb-6">IFP Connect</h1>
        <label className="block mb-3">
          <span className="block text-sm mb-1">E-mail</span>
          <input
            name="email"
            type="email"
            required
            className="w-full border rounded px-3 py-2"
          />
        </label>
        <label className="block mb-6">
          <span className="block text-sm mb-1">Senha</span>
          <input
            name="password"
            type="password"
            required
            className="w-full border rounded px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="w-full bg-slate-900 text-white rounded py-2"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 7: Criar página protegida placeholder `src/app/app/page.tsx`**

```typescript
import { auth } from "@/lib/auth";

export default async function AppHome() {
  const session = await auth();
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold">
        Olá, {session?.user?.name ?? session?.user?.email}
      </h1>
      <p className="text-slate-600 mt-2">Sessão ativa no IFP Connect.</p>
    </main>
  );
}
```

- [ ] **Step 8: Seed inicial — criar usuário Erick**

Criar `prisma/seed.ts`:

```typescript
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("ifp-dev-2026", 12);
  await db.user.upsert({
    where: { email: "erick.ramos@familiaponcio.org.br" },
    update: {},
    create: {
      email: "erick.ramos@familiaponcio.org.br",
      name: "Erick Ramos",
      hashedPassword: password,
    },
  });
  console.log("Seeded user erick.ramos");
}

main().finally(() => db.$disconnect());
```

Instalar `tsx`: `pnpm add -D tsx`

Rodar: `pnpm db:seed`
Expected: `Seeded user erick.ramos`.

- [ ] **Step 9: Validação manual ponta-a-ponta**

Run: `pnpm dev`

No browser:

1. http://localhost:3000/app → redireciona para `/login`
2. Login com `erick.ramos@familiaponcio.org.br` / `ifp-dev-2026`
3. Pousa em `/app` mostrando "Olá, Erick Ramos"

Expected: tudo funciona, sessão persiste em refresh.

Encerrar com Ctrl+C.

- [ ] **Step 10: Commit**

```bash
git add prisma/ src/lib/auth.ts src/app/ src/middleware.ts package.json pnpm-lock.yaml
git commit -m "feat: auth.js v5 com credentials + seed inicial"
```

---

## Task 9: Lint + Format (ESLint + Prettier)

**Files:**

- Create: `eslint.config.mjs`
- Create: `prettier.config.mjs`

- [ ] **Step 1: Instalar**

Run:

```bash
pnpm add -D eslint @eslint/js typescript-eslint eslint-config-next prettier eslint-config-prettier
```

- [ ] **Step 2: Criar `eslint.config.mjs`**

```javascript
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import next from "eslint-config-next";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...next(),
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "prisma/migrations/**", ".data/**"],
  },
);
```

- [ ] **Step 3: Criar `prettier.config.mjs`**

```javascript
export default {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 100,
  tabWidth: 2,
};
```

- [ ] **Step 4: Adicionar script `format` em `package.json`**

Editar `scripts`:

```json
{
  "format": "prettier --write .",
  "format:check": "prettier --check ."
}
```

- [ ] **Step 5: Rodar lint + format**

Run:

```bash
pnpm lint
pnpm format
```

Expected: lint passa (talvez com warnings); format formata os arquivos.

- [ ] **Step 6: Commit**

```bash
git add eslint.config.mjs prettier.config.mjs package.json pnpm-lock.yaml
git add -u    # arquivos reformatados
git commit -m "chore: eslint + prettier config"
```

---

## Task 10: Playwright E2E (smoke test do login)

**Files:**

- Create: `playwright.config.ts`
- Create: `tests/e2e/login.spec.ts`

- [ ] **Step 1: Instalar Playwright**

Run:

```bash
pnpm add -D @playwright/test
pnpm dlx playwright install chromium
```

- [ ] **Step 2: Criar `playwright.config.ts`**

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
```

- [ ] **Step 3: Escrever teste falhando primeiro**

Criar `tests/e2e/login.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test("login flow funciona com erick.ramos", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);

  await page.fill('input[name="email"]', "erick.ramos@familiaponcio.org.br");
  await page.fill('input[name="password"]', "ifp-dev-2026");
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL(/\/app/);
  await expect(page.locator("h1")).toContainText("Erick Ramos");
});
```

- [ ] **Step 4: Rodar e validar passa**

Garantir que Postgres está up: `docker compose -f docker-compose.dev.yml up -d`
Run: `pnpm test:e2e`
Expected: 1 teste passa.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e/
git commit -m "test: playwright e2e smoke do login"
```

---

## Task 11: GitHub Actions CI

**Files:**

- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Criar `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: ifp
          POSTGRES_PASSWORD: ifp_dev_pw
          POSTGRES_DB: ifp_connect
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://ifp:ifp_dev_pw@localhost:5432/ifp_connect
      AUTH_SECRET: ${{ secrets.AUTH_SECRET_CI || 'ci_test_secret_that_is_long_enough_x' }}
      AUTH_URL: http://localhost:3000
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm prisma migrate deploy

      - run: pnpm typecheck

      - run: pnpm lint

      - run: pnpm test

      - name: Install Playwright browsers
        run: pnpm dlx playwright install --with-deps chromium

      - name: Seed e2e DB
        run: pnpm db:seed

      - run: pnpm test:e2e
```

- [ ] **Step 2: Commit**

```bash
git add .github/
git commit -m "ci: github actions com typecheck + lint + unit + e2e"
```

- [ ] **Step 3: Validar CI (depois de push)**

Após primeiro push pro GitHub:

1. Abrir https://github.com/kiizinbr/kiizinbr-ifp-familiaponcio/actions
2. Aguardar primeira run
3. Expected: pipeline verde

Se falhar, ler logs, corrigir, commitar novamente.

---

## Task 12: Sincronizar com GitHub remote

**Files:**

- Nenhum arquivo novo.

- [ ] **Step 1: Configurar identidade git (uma vez por máquina)**

Run:

```bash
git config --global user.name "Erick Ramos"
git config --global user.email "erickramos.ti@gmail.com"
```

- [ ] **Step 2: Reescrever committer dos commits anteriores**

Como o committer dos commits anteriores ficou como `unknown <administrador@CLEAN.LAN>`, opcionalmente reescrever:

Run:

```bash
git -c user.name="Erick Ramos" -c user.email="erickramos.ti@gmail.com" rebase --root --exec "git commit --amend --no-edit --reset-author"
```

⚠️ Só fazer isso ANTES do primeiro push. Se já tiver pushado, deixar como está.

- [ ] **Step 3: Adicionar remote do GitHub**

Run:

```bash
git remote add origin https://github.com/kiizinbr/kiizinbr-ifp-familiaponcio.git
```

- [ ] **Step 4: Verificar o que tem no remote (pode ter conflito)**

Run: `git fetch origin`
Expected: lista branches do remote.

Se houver commits no `origin/main` que você não tem localmente (porque já existia coisa lá), parar e decidir estratégia:

- **a.** Trazer remote pra cá: `git pull origin main --rebase`
- **b.** Sobrescrever remote: `git push -u origin main --force-with-lease` (⚠️ destrutivo — só se for repo vazio ou bootstrap)

Em caso de dúvida, parar e pedir ajuda.

- [ ] **Step 5: Push inicial**

Run: `git push -u origin main`
Expected: push aceito; tracking branch configurada.

- [ ] **Step 6: Validar CI dispara**

Abrir https://github.com/kiizinbr/kiizinbr-ifp-familiaponcio/actions
Expected: workflow rodando.

---

## Self-Review Checklist (executado pelo autor do plano)

**1. Spec coverage:**

- ✅ Stack Next.js 16 + Postgres + Prisma + Auth.js v5 + shadcn (Tasks 3, 4, 7, 8)
- ✅ TypeScript estrito (Task 2)
- ✅ Docker dev (Task 6)
- ✅ Lint + format (Task 9)
- ✅ Testes unit + e2e (Tasks 5, 10)
- ✅ CI (Task 11)
- ⚠️ **NÃO coberto neste plano** (intencional, fica para Plano 2+): RBAC com 7 perfis, RLS policies, audit log, Ficha Cidadã, Triagem, LGPD, importador, dashboard, deploy VM. Cada um vira seu próprio plano.

**2. Placeholder scan:** Nenhum TBD/TODO/"appropriate error handling". Cada step traz código completo.

**3. Type consistency:** `db` usado consistentemente como nome do PrismaClient. `auth`, `handlers`, `signIn`, `signOut` exportados de `src/lib/auth.ts` e referenciados em todas as outras tasks.

**4. Commit cadence:** Cada Task termina com um commit independente — engenheiro pode parar e retomar entre tasks sem perder contexto.

---

## Próximos planos (a escrever após Plano 1 completar)

- **Plano 2:** RBAC + RLS — 7 perfis, middleware com role check, policies SQL, audit log, testes pgTAP
- **Plano 3:** Ficha Cidadã — model citizen + UI cadastro + busca + anexos via MinIO
- **Plano 4:** Triagem + Aprovação — screenings + unit_eligibility + workflow
- **Plano 5:** LGPD — consent versionado, ROPA, direitos do titular, soft-delete com retenção
- **Plano 6:** Importer genérico — CSV upload + mapping wizard + dry-run + dedup CPF
- **Plano 7:** Dashboard Presidência + Polish UI (skill frontend-design)
- **Plano 8:** Deploy VM + backup Azure Blob + Caddy + monitoramento
