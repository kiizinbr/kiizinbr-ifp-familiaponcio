# Projeto IFP Connect — Instituto Família Poncio

Arquivo de memória do projeto. Sempre que retomar a sessão (Claude Code, Claude.ai ou outro agente), leia este documento PRIMEIRO. Ele contém o contexto, decisões já tomadas, status atual e os próximos passos. Mantenha este arquivo atualizado a cada rodada de trabalho.

---

## 1. Sobre o Instituto Família Poncio

O Instituto Família Poncio (IFP) é uma organização filantrópica sediada em Duque de Caxias (Jardim Gramacho — Rod. Washington Luiz). Presidente: Simone Poncio.

### Missão

Excelência, comprometimento e amor ao próximo. Atender gratuitamente pessoas em situação de vulnerabilidade social oferecendo saúde, capacitação profissional, esporte e educação infantil, sempre com triagem feita por Serviço Social próprio.

### As 4 unidades (todas em Caxias, locais e gestores distintos)

1. **Centro Médico** — atendimento médico filantrópico (odontologia completa, endocrinologia, ginecologia, cardiologia, psiquiatria, psicologia e outras especialidades).
2. **Centro de Capacitação** — cursos gratuitos: costura, informática, barbeiro, cabeleireira, massagem, design etc.
3. **Centro Esportivo** — hoje apenas Jiu-Jitsu, com previsão de novas modalidades.
4. **Centro Recreativo / Educacional** — modelo de creche: atividades interativas, descanso, brincadeiras e alimentação para crianças.

Todas as unidades atendem pessoas previamente avaliadas pelo Serviço Social (entrevista, critérios de renda, benefícios, vulnerabilidade).

---

## 2. Arquitetura aprovada — IFP Connect

Plataforma única, multi-tenant lógico, com 4 módulos verticais isolados + camada transversal de Serviço Social + visão executiva da Presidência.

```
                    PRESIDÊNCIA (Simone Poncio)
           Dashboard consolidado • KPIs • Auditoria
                              |
             SERVIÇO SOCIAL (camada transversal)
   Ficha Cidadã única • Triagem • Aprovação • Reavaliação
   Vê dados sociais e de matrícula de TODAS as unidades
       |             |              |              |
   CENTRO        CAPACI-         CENTRO         EDUCAC.
   MÉDICO        TAÇÃO         ESPORTIVO       (Creche)
   teal          laranja        terracota        teal
  #10C2BB        #FF772E        #752C05        #007571
```

### Princípios

- **Isolamento entre unidades**: gestor de uma unidade nunca vê dados operacionais de outra.
- **Serviço Social é a única camada transversal** (vê parte dos dados das 4 unidades).
- **Presidência** vê dashboards agregados, não dados clínicos individuais.
- **Ficha Cidadã única**: o mesmo cidadão pode ser beneficiário de várias unidades sem duplicar cadastro.
- **Multi-tenant lógico**: 1 banco, tenant_id em cada registro, Row-Level Security no Postgres.
- **LGPD desde o dia 1**: consentimentos, logs de auditoria, criptografia, direito ao esquecimento.

---

## 3. Design System (extraído do brandbook oficial)

### Paleta de cores

| Token | HEX | Uso |
|---|---|---|
| --ifp-orange-primary | #FF772E | Cor institucional, CTAs, tema Capacitação |
| --ifp-orange-mid | #C24D0F | Hover, textos de destaque |
| --ifp-orange-deep | #752C05 | Tema Esportivo, dark accents |
| --ifp-teal-deep | #007571 | Tema Centro Recreativo / Educacional |
| --ifp-teal-bright | #10C2BB | Tema Centro Médico |
| --ifp-gray | #4A4A49 | Texto corpo |
| --ifp-white | #FFFFFF | Background |

Degradês oficiais: laranja #FF772E → #C24D0F → #752C05 e teal #10C2BB → #007571.

Tokens implementados em: `packages/design-tokens/tokens.css` (CSS variables) e consumidos por `apps/web/tailwind.config.ts`.

### Tipografia

- **Fonte principal**: Garet (Light, Book, Regular, Bold, Heavy).
- **Fallback web**: Inter ou Plus Jakarta Sans.

### Identidade visual

- Logo: leão coroado dentro de moldura ogival. Versões por unidade: Instituto, Centro Médico, Centro de Capacitação, Centro Esportivo, Centro Recreativo.
- Grafismo: leão pode ser usado como elemento gráfico complementar (gradiente ou contorno), nunca como janela para imagens, nunca em cores fora da paleta.
- Fotografia: humanizada, espontânea, luz natural, fundo desfocado, representando diversidade, cuidado e acolhimento. Evitar imagens frias, clínicas ou poses artificiais.

---

## 4. Ficha Cidadã (núcleo do Serviço Social)

Registro unificado da família atendida. Criado uma única vez pelo Serviço Social.

### Campos principais

- **Responsável familiar (titular)**: CPF, RG, nome completo, foto, endereço, contatos, data de nascimento.
- **Composição familiar**: cada membro vira sub-cadastro (nome, parentesco, idade, ocupação).
- **Dados socioeconômicos**: renda familiar total, renda per capita, benefícios (Bolsa Família, BPC, Auxílio Gás), situação de moradia (própria/alugada/cedida), escolaridade do titular, vulnerabilidades observadas.
- **Documentação anexada**: RG, CPF, comprovante de residência, comprovante de renda, CadÚnico.
- **Histórico de entrevistas** com assistente social (data, profissional, observações).
- **Status de elegibilidade por unidade**: cada unidade tem critérios próprios; o Serviço Social marca elegibilidade como pendente / aprovado / reprovado / suspenso por unidade.
- **Termos de consentimento LGPD** (uso de dados, uso de imagem, comunicação por WhatsApp).

### Regra de visibilidade

Gestores de unidade veem apenas pessoas com status aprovado para sua unidade, e só veem: nome, foto, contato, flag de elegibilidade. Dados socioeconômicos sensíveis ficam restritos ao Serviço Social. Prontuário clínico é sigilo exclusivo do Centro Médico.

Modelos Prisma já criados em `packages/database/schema.prisma`:
`FichaCidada`, `MembroFamiliar`, `DadosSocioeconomicos`, `Documento`, `Entrevista`, `ElegibilidadePorUnidade`, `Consentimento`, `AuditLog`, `Unidade`, `User`, `UsuarioPerfil`, `UsuarioUnidade`.

---

## 5. Módulos por unidade (resumo)

### 5.1 Centro Médico (tema teal #10C2BB)

Referências: iClinic, Feegow, Tasy, ProDoctor.

- Agenda multi-profissional por especialidade
- Prontuário Eletrônico (anamnese, evolução, SOAP, CID-10)
- Recepção / triagem de enfermagem / check-in
- Prescrição e atestado digital
- Confirmação por WhatsApp (redução de no-show)
- Indicadores e relatórios; integração CNES/e-SUS (fase 3)

### 5.2 Centro de Capacitação (tema laranja #FF772E)

Referências: Sponte, Moodle, Sympla.

- Catálogo de cursos com ementa, turmas, vagas
- Matrícula vinculada à Ficha Cidadã
- Diário de classe digital, chamada por QR Code
- Controle de frequência e evasão automática
- Emissão de certificados com identidade do Instituto
- Banco de talentos / encaminhamento ao mercado

### 5.3 Centro Esportivo (tema terracota #752C05)

Referências: Tatame Manager, SportSystem.

- Modalidades, turmas e horários
- Controle de graduação (faixas, listras, histórico)
- Frequência por aula (tablet/celular do professor)
- Atestado médico com bloqueio se vencido
- Eventos e autorizações de responsáveis

### 5.4 Educacional / Centro Recreativo (tema teal #007571)

Referências: Agenda Edu, ClassApp.

- Cadastro da criança vinculado ao responsável
- Rotina diária (alimentação, sono, atividades, troca)
- Diário de bordo com fotos (acesso restrito aos pais)
- Comunicados e autorizações
- Check-in/out com QR Code do responsável
- Ficha de saúde da criança (alergias, medicações)
- App dos pais (PWA mobile-first)

---

## 6. Stack tecnológica definida

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: NestJS (Node.js + TypeScript)
- **Banco**: PostgreSQL com Row-Level Security + Redis (cache/filas)
- **ORM**: Prisma
- **Auth**: Auth.js (NextAuth) — SSO entre módulos
- **Storage**: S3-compatible (AWS S3 / Cloudflare R2 / MinIO)
- **Filas**: BullMQ
- **Mensageria**: WhatsApp via Z-API ou Twilio; e-mail via Resend/SES
- **Infra**: Docker + GitHub Actions; deploy em AWS/GCP (créditos para ONG) ou Hetzner
- **Mobile**: PWA mobile-first (app nativo React Native em fase 2 se necessário)
- **Monorepo**: Turborepo + pnpm workspaces

---

## 7. Estrutura de pastas (estado atual no repo)

```
kiizinbr-ifp-familiaponcio/
├── projetoifp.md                  ✅ memória do projeto
├── README.md                      ✅ inicial
├── .gitignore                     ✅ Node/Next.js/Prisma
├── .env.example                   ✅ template de variáveis (DATABASE_URL, NEXTAUTH_*, ...)
├── .nvmrc                         ✅ Node 20.18.0
├── .npmrc                         ✅ engine-strict, auto-install-peers
├── .prettierrc.json               ✅ Prettier + plugin Tailwind
├── .prettierignore                ✅
├── package.json                   ✅ root do monorepo (scripts turbo, prettier, ts)
├── pnpm-workspace.yaml            ✅ workspaces apps/* e packages/*
├── pnpm-lock.yaml                 ✅ lockfile (gerado por pnpm install)
├── turbo.json                     ✅ pipeline (build, dev, lint, typecheck, db:*)
├── tsconfig.base.json             ✅ TS strict compartilhado
├── docker-compose.yml             ✅ dev (Postgres + Redis)
├── docker-compose.prod.yml        ✅ produção (postgres + redis + api + web + caddy + migrate)
├── docker-compose.onprem.yml      ✅ override pra LAN interna (porta 80 só, Caddyfile.internal)
├── .dockerignore                  ✅ root (exclui node_modules, exports, backups, etc.)
├── .env.production.example        ✅ template (público — Let's Encrypt)
├── .env.onprem.example            ✅ template (LAN — ifp.lan, sem Let's Encrypt)
├── caddy/
│   ├── Caddyfile                  ✅ produção pública (HTTPS automático via Let's Encrypt)
│   └── Caddyfile.internal         ✅ on-prem LAN (HTTP + opção `tls internal` comentada)
├── apps/
│   ├── web/                       ✅ @ifp/web — Next.js 14 (App Router) bootstrappado
│   │   ├── package.json
│   │   ├── Dockerfile             (multi-stage standalone)
│   │   ├── .dockerignore
│   │   ├── tsconfig.json          (estende tsconfig.base)
│   │   ├── next.config.mjs        (serverComponentsExternalPackages: Prisma, bcrypt)
│   │   ├── postcss.config.mjs
│   │   ├── tailwind.config.ts     (consome tokens IFP)
│   │   ├── .eslintrc.json         (next/core-web-vitals)
│   │   ├── next-env.d.ts
│   │   ├── lib/cn.ts              (utilitário clsx + tailwind-merge)
│   │   └── app/
│   │       ├── layout.tsx         (Inter como fallback até Garet chegar)
│   │       ├── page.tsx           (homepage com 4 unidades)
│   │       └── globals.css        (importa @ifp/design-tokens/tokens.css)
│   └── api/                       ✅ @ifp/api — NestJS 10 bootstrappado
│       ├── package.json
│       ├── tsconfig.json
│       ├── nest-cli.json
│       ├── Dockerfile             (multi-stage com target migrator)
│       ├── .dockerignore
│       └── src/
│           ├── main.ts            (Helmet, ValidationPipe, Swagger em /api/docs)
│           ├── app.module.ts      (Throttler global, ConfigModule, todos os módulos)
│           ├── health.controller.ts
│           ├── prisma/            (PrismaService global)
│           ├── audit/             (AuditService global — AuditLog LGPD)
│           ├── auth/              (login JWT + JwtStrategy + Perfis decorator/guard)
│           ├── users/             (UsersService: findByEmail, findByIdWithPerfis)
│           ├── tenants/           (placeholder)
│           └── fichas-cidadas/    (Service + Controller + DTOs validados — CRUD completo)
├── packages/
│   ├── ui/
│   │   ├── package.json           ✅ @ifp/ui (cva, clsx, lucide)
│   │   ├── tsconfig.json
│   │   └── src/index.ts           placeholder de exports
│   ├── design-tokens/
│   │   ├── package.json           ✅ @ifp/design-tokens (export ./tokens.css)
│   │   └── tokens.css             paleta + tipografia + temas por unidade
│   └── database/
│       ├── package.json           ✅ @ifp/database (Prisma 5, bcryptjs, tsx)
│       ├── tsconfig.json
│       ├── src/index.ts           PrismaClient singleton + re-export
│       ├── schema.prisma          Ficha Cidadã + RBAC + AuditLog (relação User↔Ficha corrigida)
│       └── prisma/seed.ts         seed das 4 Unidades + Super Admin (opt-in via env)
└── docs/
    ├── deploy-vps.md              ✅ walkthrough de deploy em VPS público
    └── deploy-onprem-hyperv.md    ✅ walkthrough de deploy em Hyper-V (LAN interna)
```

Versões pinadas (engines): Node ≥ 20.11, pnpm ≥ 9. Stack instalada: Next 14.2.35, NestJS 10.4, Prisma 5.22, Tailwind 3.4, Turbo 2.9, TS 5.9.

**Validação local**: `pnpm install` (957 pacotes), `pnpm db:generate` ok, `tsc --noEmit` passa nos 4 workspaces, `next build` e `nest build` concluem sem erros, `next lint` limpo.

PENDENTE: primeira migration do Prisma (precisa de Postgres rodando), implementação real dos módulos NestJS (auth/users/tenants/fichas), Auth.js no `apps/web`, fonte Garet, logos SVG.

---

## 8. RBAC — perfis previstos

| Perfil | Escopo | Pode ver |
|---|---|---|
| Super Admin | Global | Tudo (uso técnico) |
| Presidência | Global | Dashboards agregados, auditoria, sem PEP individual |
| Serviço Social | Global (transversal) | Fichas Cidadãs completas, status em todas unidades |
| Gestor de Unidade | 1 unidade | Operação completa da sua unidade |
| Profissional (médico/professor/instrutor) | 1 unidade, seus pacientes/alunos | Dados clínicos/pedagógicos dos seus atendidos |
| Recepção | 1 unidade | Agendamento, check-in, busca de fichas aprovadas |
| Responsável Familiar | Próprio núcleo | App: rotina do filho, agenda médica, certificados |

Enum `Perfil` já definido no `schema.prisma`.

---

## 9. Roadmap em fases

- **Fase 0 — Fundação (4–6 semanas)**: monorepo, design system, auth, RBAC, Serviço Social + Ficha Cidadã. ⏳ em andamento
- **Fase 1 — MVP por unidade (8–12 semanas)**: agendamento + presença + busca de beneficiários. Começar por Centro Médico e Educacional.
- **Fase 2 — Aprofundamento (3–4 meses)**: prontuário completo, certificados, app dos pais, WhatsApp, dashboards.
- **Fase 3 — Integrações**: e-SUS/CNES, BI para doadores, app mobile nativo.

---

## 10. Status atual do projeto

### Concluído

- [x] Levantamento de requisitos e contexto
- [x] Análise do brandbook (cores, tipografia, logos por unidade, fotografia, grafismos)
- [x] Arquitetura macro aprovada (multi-tenant lógico, Serviço Social transversal)
- [x] Definição do conceito da Ficha Cidadã
- [x] Modelagem inicial dos 4 módulos
- [x] Stack tecnológica definida
- [x] Roadmap em 4 fases aprovado
- [x] Repositório criado (kiizinbr/kiizinbr-ifp-familiaponcio)
- [x] Criação do projetoifp.md (este arquivo)
- [x] .gitignore (Node/Next.js/Prisma)
- [x] Estrutura inicial de pastas (apps/web, apps/api, packages/ui, packages/design-tokens, packages/database, docs)
- [x] packages/design-tokens/tokens.css com paleta IFP + temas por unidade
- [x] packages/database/schema.prisma com Ficha Cidadã, Unidades, RBAC, AuditLog
- [x] apps/web/tailwind.config.ts consumindo tokens
- [x] `package.json` root do monorepo (scripts turbo, prettier, db:*)
- [x] `pnpm-workspace.yaml` (workspaces apps/* e packages/*)
- [x] `turbo.json` (pipeline build/dev/lint/typecheck/test/db:*)
- [x] `tsconfig.base.json` (TS 5 strict + noUncheckedIndexedAccess)
- [x] `.nvmrc` (Node 20.18.0), `.npmrc` (engine-strict, auto-install-peers)
- [x] `.prettierrc.json` + `.prettierignore` (com plugin Tailwind)
- [x] `apps/web/package.json` (@ifp/web, Next 14.2 + RHF + zod + RQ + zustand)
- [x] `apps/api/package.json` (@ifp/api, NestJS 10.4 + JWT + Passport + BullMQ + Helmet)
- [x] `packages/database/package.json` + `src/index.ts` (Prisma 5.18, singleton)
- [x] `packages/design-tokens/package.json` (export ./tokens.css)
- [x] `packages/ui/package.json` + `src/index.ts` (cva + clsx + lucide, peer React 18)
- [x] `pnpm install` rodado — 957 pacotes, `pnpm-lock.yaml` commitado
- [x] `pnpm db:generate` ok (Prisma Client gerado a partir do schema)
- [x] Fix: relação `User.fichaCidada ↔ FichaCidada.user` agora com `fields`/`references`
- [x] Bootstrap completo do **Next.js 14** em `apps/web`: `app/layout.tsx`, `app/page.tsx` (homepage com 4 unidades), `app/globals.css` (importa tokens), `next.config.mjs`, `postcss.config.mjs`, `tsconfig.json`, `.eslintrc.json`, `lib/cn.ts` — `next build` e `next lint` passam
- [x] Bootstrap completo do **NestJS 10** em `apps/api`: `main.ts` (Helmet + ValidationPipe + Swagger em `/api/docs`), `app.module.ts` (Throttler global, ConfigModule), `health.controller.ts`, `prisma/` (PrismaService global), módulos placeholder `auth/`, `users/`, `tenants/`, `fichas-cidadas/` — `nest build` passa
- [x] `packages/database/prisma/seed.ts` (upsert das 4 Unidades + Super Admin opt-in via env)
- [x] `tsconfig.json` em cada workspace (estendendo `tsconfig.base.json`)
- [x] `.env.example` com DATABASE_URL, NEXTAUTH_*, JWT_*, API_URL, SEED_*
- [x] `docker-compose.yml` (Postgres 16 + Redis 7 com healthchecks e volumes nomeados)
- [x] **Auth real no NestJS**: `AuthService` (bcrypt + emite JWT), `AuthController` (`POST /api/v1/auth/login`, `GET /api/v1/auth/me`), `JwtStrategy` (Passport), `JwtAuthGuard`, decorator `@CurrentUser`, `UsersService` (`findByEmail`, `findByIdWithPerfis`, `registrarLogin`)
- [x] **Auth.js no Next.js**: `lib/auth.ts` com `CredentialsProvider` chamando a API, callbacks `jwt`/`session` propagando `accessToken`/`perfis`/`unidades`, tipos extendidos em `types/next-auth.d.ts`, route handler em `app/api/auth/[...nextauth]/route.ts`, `Providers` (SessionProvider) injetado no `RootLayout`
- [x] Página `/login` (form e-mail/senha com tratamento de erro) e `/servico-social` (rota protegida por sessão + checagem de perfil SUPER_ADMIN/SERVICO_SOCIAL)
- [x] **Deploy plug-and-play em VPS**: Dockerfiles multi-stage para `apps/web` (Next.js standalone) e `apps/api` (pnpm deploy + target `migrator`), `.dockerignore` na raiz e em cada app, `docker-compose.prod.yml` (postgres + redis + api + web + caddy + migrate como service `tools`), `caddy/Caddyfile` com HTTPS automático via Let's Encrypt, `.env.production.example`, `docs/deploy-vps.md` com walkthrough completo. `next build` valida o output standalone.
- [x] **RBAC por perfil**: `@Perfis(...perfis)` decorator + `PerfisGuard` consultando metadata via `Reflector`. Falha com `ForbiddenException` se o usuário não tem nenhum dos perfis requeridos.
- [x] **AuditLog service** (`AuditModule` global): wrapper `audit.registrar({ userId, acao, entidade, entidadeId, metadados })` que nunca bloqueia a operação principal (falha de gravação só vira log).
- [x] **CRUD de Ficha Cidadã**: `FichasCidadasService` + `FichasCidadasController` protegidos por `JwtAuthGuard + PerfisGuard` (SUPER_ADMIN ou SERVICO_SOCIAL). Endpoints: `POST /fichas-cidadas` (cria titular, gera protocolo `IFP-YYYY-XXXXXX`), `GET /fichas-cidadas` (paginação + filtros por nome/CPF/protocolo/status/unidade/ativa), `GET /fichas-cidadas/:id` (registra READ no audit), `PATCH /fichas-cidadas/:id`, `PUT /fichas-cidadas/:id/membros`, `PUT /fichas-cidadas/:id/dados-socio`, `PUT /fichas-cidadas/:id/elegibilidade/:unidadeSlug`. Todos documentados via Swagger e com `class-validator` nos DTOs.
- [x] **Deploy on-prem (Hyper-V + Ubuntu)**: `caddy/Caddyfile.internal` (HTTP por padrão, com opção comentada de `tls internal`), `docker-compose.onprem.yml` (override que usa `!override` em `ports` pra ficar só na 80), `.env.onprem.example` com hostnames `ifp.lan` / `api.ifp.lan`, `docs/deploy-onprem-hyperv.md` com 12 passos (Hyper-V VM specs e External Switch, instalação do Ubuntu Server 22.04, IP estático via Netplan, Docker via get.docker.com, ufw, build/migrate/seed/up, DNS interno via hosts ou AD, smoke tests, atualização, backup com cron, opção de HTTPS interno via Caddy CA, troubleshooting).

### Próximos passos (próxima sessão)

1. **Provisionar a VM Hyper-V** seguindo `docs/deploy-onprem-hyperv.md` (External Switch, Ubuntu Server 22.04, Netplan com IP estático, Docker, ufw). Dentro da VM, `docker compose -f docker-compose.prod.yml -f docker-compose.onprem.yml --env-file .env.production up -d` + DNS interno (hosts file ou A record no AD).
2. **Telas do Serviço Social** em `apps/web`:
   - `/servico-social/fichas` (listagem com filtros + paginação)
   - `/servico-social/fichas/nova` (wizard de 6 etapas que consome o CRUD criado)
   - `/servico-social/fichas/[id]` (detalhe + ações de elegibilidade)
   - Hook `useAuthFetch` que injeta o `accessToken` da sessão em todas as chamadas.
3. **Row-Level Security no Postgres**: policies por `unidadeId` após primeira migration; criar role `app_user` que respeita RLS.
4. **Documentos e consentimentos** (etapas 4 e 5 do wizard): upload pra storage S3-compatível (signed URLs) + endpoints `POST /fichas-cidadas/:id/documentos` e `POST /fichas-cidadas/:id/consentimentos`.
5. **Magic link via Resend**: provider adicional no Auth.js + endpoint no NestJS pra emitir token de um clique. Obrigatório no primeiro login.
6. **Layout base com troca de tema por unidade** (`data-theme` no `<html>`) e header com menu de unidades.
7. **Logo SVG e fonte Garet**: arquivos do Erick em `apps/web/public/` e `apps/web/app/fonts/` (substituir Inter por `next/font/local`).
8. **ESLint compartilhado**: `@typescript-eslint` + plugin Nest em `apps/api` e flat config em `packages/ui` (hoje noop).

### Decisões pendentes (perguntar ao Erick / Simone)

- Volume aproximado de atendidos por unidade (mês) — para dimensionar infra.
- Hoje vocês usam alguma planilha/sistema que precisará ser migrado?
- Quem serão os primeiros usuários piloto?
- Vocês emitem produção SUS? (define se precisamos integrar CNES já no MVP)
- Hospedagem preferida (AWS com créditos ONG, GCP, Hetzner)?
- Logotipo em SVG vetorial disponível? Fonte Garet (.otf/.woff2) disponível?

---

## 11. Como retomar este projeto

Ao iniciar uma nova sessão (Claude Code, Claude.ai, etc.):

1. Leia este projetoifp.md inteiro.
2. Verifique a seção Status atual para saber onde paramos.
3. Confirme com o Erick se as decisões pendentes foram resolvidas.
4. Comece pela primeira tarefa não marcada em Próximos passos.
5. Ao terminar a sessão, atualize este arquivo: mova itens para Concluído e atualize Próximos passos.

Contato do projeto:

- Dev: Erick Ramos (kiizinbr)
- Cliente: Instituto Família Poncio — Presidente Simone Poncio
- Endereço: Rod. Washington Luiz, Jardim Gramacho, Duque de Caxias/RJ

---

## 12. Histórico de sessões

### Sessão 1 — Arquitetura e bootstrap do repositório

- Levantamento completo do contexto e missão do Instituto.
- Análise do brandbook (paleta, tipografia, logos por unidade, grafismos).
- Definição da arquitetura macro IFP Connect (multi-tenant lógico).
- Conceito da Ficha Cidadã como núcleo do Serviço Social.
- Stack e roadmap aprovados.
- Repositório criado e estrutura inicial commitada:
  - `projetoifp.md` (memória do projeto)
  - `.gitignore`
  - `packages/design-tokens/tokens.css`
  - `packages/database/schema.prisma`
  - `apps/web/tailwind.config.ts`
  - `.gitkeep` em `apps/api`, `packages/ui`, `docs`

### Sessão 2 — Setup do monorepo (passo 1 da seção 10)

- `package.json` raiz com scripts agregados via Turbo (build/dev/lint/typecheck/test) e atalhos para o Prisma (`db:generate`, `db:migrate`, `db:seed`, `db:studio`).
- `pnpm-workspace.yaml` cobrindo `apps/*` e `packages/*`.
- `turbo.json` com pipeline declarando dependências entre tasks (build depende de `^build` e `^db:generate`).
- `tsconfig.base.json` compartilhado (strict, ES2022, moduleResolution Bundler, `noUncheckedIndexedAccess`).
- `.nvmrc` (Node 20.18.0), `.npmrc` (engine-strict, auto-install-peers), `.prettierrc.json` + `.prettierignore` com plugin Tailwind.
- `package.json` de cada workspace com versões pinadas:
  - `@ifp/web` — Next.js 14.2, React Hook Form, Zod, TanStack Query/Table, Zustand, NextAuth, lucide.
  - `@ifp/api` — NestJS 10.4, JWT/Passport, BullMQ + ioredis, Helmet, class-validator, Swagger.
  - `@ifp/database` — Prisma 5.18, `src/index.ts` com `PrismaClient` singleton e re-export dos tipos.
  - `@ifp/design-tokens` — exporta `./tokens.css` como entrada principal.
  - `@ifp/ui` — cva + clsx + tailwind-merge + lucide, peer React 18.
- Removidos `.gitkeep` de `apps/api` e `packages/ui` (substituídos por `package.json` e `src/`).

### Sessão 3 — Instalação, bootstrap dos apps e seed (passos 1–4 da seção 10)

- `pnpm install` rodado com sucesso: 957 pacotes resolvidos, `pnpm-lock.yaml` gerado e commitado.
- Bug do schema corrigido: relação `User.fichaCidada ↔ FichaCidada.user` agora declara `fields: [fichaCidadaId], references: [id]` no lado do User. `prisma generate` passa.
- **Next.js 14.2 bootstrap** em `apps/web/`: `next.config.mjs` (com `serverComponentsExternalPackages` pra Prisma/bcrypt e `transpilePackages` pros workspaces internos), `tsconfig.json`, `postcss.config.mjs`, `.eslintrc.json` (next/core-web-vitals), `next-env.d.ts`, `lib/cn.ts` (clsx + tailwind-merge), `app/globals.css` importando `@ifp/design-tokens/tokens.css`, `app/layout.tsx` (Inter como fallback enquanto Garet não chega), `app/page.tsx` (homepage exibindo as 4 unidades com os temas IFP). `next build` e `next lint` passam.
- **NestJS 10 bootstrap** em `apps/api/`: `main.ts` (Helmet + CORS + ValidationPipe global + Swagger em `/api/docs` + prefix `api/v1`), `app.module.ts` (ConfigModule global + ThrottlerGuard global + módulos), `health.controller.ts` (`GET /api/v1/health`), `prisma/` (`PrismaService` extendendo `PrismaClient` com `OnModuleInit/Destroy` e marcado `@Global`), módulos placeholder `auth/`, `users/`, `tenants/`, `fichas-cidadas/`. `nest build` passa.
- **Seed do Prisma**: `packages/database/prisma/seed.ts` faz upsert das 4 Unidades (slugs `medico`/`capacitacao`/`esportivo`/`educacional`) e, se `SEED_SUPER_ADMIN_PASSWORD` estiver setado, cria um Super Admin com bcryptjs.
- `tsconfig.json` em todos os workspaces estendendo `tsconfig.base.json`. `tsc --noEmit` passa em `@ifp/web`, `@ifp/api`, `@ifp/database` e `@ifp/ui`.
- `.env.example` na raiz documentando DATABASE_URL, NEXTAUTH_*, RESEND_API_KEY e seed.
- Lint dos workspaces sem ESLint config (`apps/api`, `packages/ui`) virou noop temporário pra não quebrar o `turbo run lint` — config real fica pra próxima sessão.

### Sessão 7 — Deploy on-prem (Hyper-V + Ubuntu Server, LAN interna)

- `caddy/Caddyfile.internal`: serve em HTTP (porta 80) por padrão com `auto_https off`; bloco `tls internal` comentado pra ligar HTTPS com a CA interna do Caddy quando quiser.
- `docker-compose.onprem.yml`: override do `docker-compose.prod.yml` que usa `ports: !override` pra ficar só com a porta 80 (sem 443), monta o `Caddyfile.internal` em vez do externo, e neutraliza o `ACME_EMAIL` (não fala com Let's Encrypt). Uso: `docker compose -f docker-compose.prod.yml -f docker-compose.onprem.yml --env-file .env.production up -d`.
- `.env.onprem.example`: template com hostnames internos (`WEB_DOMAIN=ifp.lan`, `API_DOMAIN=api.ifp.lan`), `WEB_ORIGIN=http://ifp.lan`, e placeholders sinalizando "gerar com openssl rand".
- `docs/deploy-onprem-hyperv.md` (12 seções): specs da VM no Hyper-V Manager (Generation 2, 2 vCPU, 4 GB, 60 GB, External Switch), instalação do Ubuntu 22.04 com OpenSSH, IP estático via Netplan, instalação do Docker via `get.docker.com`, firewall com `ufw`, clone do repo, `.env.production` derivado do `.env.onprem.example`, build/migrate/seed/up, DNS interno (hosts file OU A records no AD), smoke tests, atualização contínua, backup diário do Postgres via cron com retenção de 30 dias, instruções para ligar HTTPS interno depois (cert root da Caddy CA via GPO), tabela de troubleshooting, e nota de escalonamento.
- Validado: `docker compose -f docker-compose.prod.yml -f docker-compose.onprem.yml config` mostra `caddy` com apenas porta 80 mapeada e `Caddyfile.internal` em bind mount.

### Sessão 6 — CRUD da Ficha Cidadã na API (RBAC + AuditLog)

- `@Perfis(...perfis)` decorator (`SetMetadata`) + `PerfisGuard` (lê metadata via `Reflector`, valida contra `user.perfis`). Lança `ForbiddenException` com mensagem explicando o perfil necessário.
- `AuditModule` global com `AuditService.registrar(...)` (fire-and-forget: falha de gravação só gera log, nunca bloqueia operação). Eventos: `CREATE`, `READ`, `UPDATE` registrados nas operações da Ficha Cidadã.
- DTOs com `class-validator` + `class-transformer`:
  - `CreateFichaCidadaDto` (titular + contato + endereço; normaliza CPF/CEP/telefone removendo não-dígitos via `@Transform`).
  - `UpdateFichaCidadaDto` (estende `PartialType` do nest swagger + flag `ativa`).
  - `ListFichasQuery` (page, perPage 1-100, `q`, `unidade`, `status`, `ativa`).
  - `ReplaceMembrosDto` (array aninhado validado, decimal para renda mensal).
  - `UpsertDadosSocioDto` (renda total/per capita, benefícios, situação de moradia, infraestrutura, vulnerabilidades).
  - `UpdateElegibilidadeDto` (status + motivo + reavaliarEm).
- `FichasCidadasService`:
  - `create` checa unicidade do CPF, gera protocolo `IFP-${ano}-${randomBytes(3).hex.upper()}`, retorna ficha com todas as relações incluídas.
  - `findOne` registra `READ` no audit log (LGPD).
  - `findAll` constrói `Prisma.FichaCidadaWhereInput` dinamicamente, busca por nome (case-insensitive), CPF (só dígitos) e protocolo (uppercase); filtra elegibilidades por slug da unidade e/ou status; retorna `{ items, pagination }`.
  - `update`, `replaceMembros` (transação: deleteMany + createMany), `upsertDadosSocio` (Decimal nos valores), `updateElegibilidade` (upsert via `fichaId_unidadeId`).
- `FichasCidadasController` protegido por `@UseGuards(JwtAuthGuard, PerfisGuard)` + `@Perfis(SUPER_ADMIN, SERVICO_SOCIAL)`. 7 endpoints documentados via `@ApiOperation`/`@ApiParam` (visíveis em `/api/docs`).
- `AppModule` agora importa `AuditModule`; antigo `users/users.module` placeholder virou módulo com `UsersService` exportado.
- Validado: `pnpm --filter @ifp/api typecheck` + `build` (28 arquivos `.js` em `dist/`, incluindo `auth/perfis.guard`, `audit/audit.service` e toda a árvore `fichas-cidadas/`).

### Sessão 5 — Deploy plug-and-play (Dockerfiles, compose de produção, Caddy)

- `apps/web/Dockerfile` multi-stage (deps → builder → runner) usando `output: "standalone"` do Next.js. Roda como usuário não-root, telemetria desligada, expõe :3000.
- `apps/web/next.config.mjs`: adicionado `output: "standalone"` e `outputFileTracingRoot` apontando pra raiz do monorepo (pnpm workspaces precisa disso pra incluir pacotes internos no bundle).
- `apps/api/Dockerfile` multi-stage usando `pnpm deploy --filter @ifp/api --prod /prod/api` pra criar bundle auto-suficiente. Target adicional `migrator` reaproveita o builder pra rodar `prisma migrate deploy` em produção.
- `.dockerignore` na raiz e em cada app (exclui `node_modules`, `.next`, `.git`, `.env`, exports/backups/data — proteção LGPD).
- `docker-compose.prod.yml` na raiz: services `postgres`, `redis` (com `--requirepass`), `api`, `web`, `caddy` (HTTPS automático), `migrate` (no profile `tools` pra rodar uma vez). Todos com `restart: unless-stopped`, healthchecks e network `ifp-net`. Volumes nomeados para dados de cada um, mais `ifp-caddy-data` pra certificados.
- `caddy/Caddyfile`: dois sites (`{$WEB_DOMAIN}` e `{$API_DOMAIN}`) com encode gzip+zstd, cache-control para `/_next/static`, reverse_proxy com headers de forwarded.
- `.env.production.example`: template com `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET`, `NEXTAUTH_SECRET`, `WEB_DOMAIN`, `API_DOMAIN`, `WEB_ORIGIN`, `ACME_EMAIL`.
- `docs/deploy-vps.md`: walkthrough de 9 passos (preparar VPS Ubuntu, instalar Docker, clonar repo, build, migrate, seed, up, smoke tests, update, backup do Postgres via cron, escalar quando crescer).
- `docs/.gitkeep` substituído pelo doc real.
- Validação: `docker compose -f docker-compose.prod.yml --env-file .env.production.example config` parseia ok, `next build` produz `.next/standalone/apps/web/server.js`.

### Sessão 4 — Docker, Auth real (NestJS + Auth.js) e rota protegida

- `docker-compose.yml` na raiz com Postgres 16 e Redis 7 (volumes nomeados + healthchecks). Comandos: `docker compose up -d` para subir, `docker compose down -v` para resetar.
- **NestJS — autenticação real**:
  - `AuthService.login(email, senha)`: busca usuário por e-mail (lowercased), valida `senhaHash` com `bcrypt.compare`, registra `ultimoLogin`, emite JWT com `{ sub, email, perfis[] }` e retorna `{ accessToken, user: { id, nome, email, perfis, unidades } }`.
  - `AuthController`: `POST /api/v1/auth/login` (com `class-validator` no `LoginDto`) e `GET /api/v1/auth/me` protegido por `JwtAuthGuard`.
  - `JwtStrategy`: Passport JWT extraindo `Authorization: Bearer …`, secret via `ConfigService` (`JWT_SECRET`), `validate` confirma que o usuário continua existindo e ativo.
  - `UsersService`: `findByEmail`, `findById`, `findByIdWithPerfis` (inclui perfis e unidades), `registrarLogin`.
  - Decorator `@CurrentUser` para extrair o usuário injetado pelo guard.
- **Next.js — Auth.js (next-auth v4)**:
  - `lib/auth.ts` com `CredentialsProvider` que chama `POST ${API_URL}/auth/login`. Callbacks `jwt`/`session` propagam `accessToken`, `perfis` e `unidades` para a sessão.
  - Tipos estendidos em `types/next-auth.d.ts` (`User`, `Session`, `JWT`).
  - Route handler em `app/api/auth/[...nextauth]/route.ts`.
  - `app/providers.tsx` com `SessionProvider`, injetado no `RootLayout` via `getServerSession`.
  - `app/login/page.tsx`: formulário e-mail/senha com `signIn("credentials", …, { redirect: false })`, exibindo erro inline.
  - `app/servico-social/page.tsx`: server component que `redirect("/login?callbackUrl=…")` se não houver sessão e checa se a sessão tem perfil `SUPER_ADMIN` ou `SERVICO_SOCIAL`. Mostra dashboard placeholder com cards de "Nova Ficha", "Pendentes", "Reavaliações".
- `.env.example` ganhou `JWT_SECRET`, `JWT_EXPIRES_IN` e `API_URL`.
- Validação local: `tsc --noEmit` passa em todos os workspaces, `next build` agora prerenderiza 6 rotas (`/`, `/login`, `/servico-social`, `/api/auth/[...nextauth]`, `/_not-found`, mais o layout), `nest build` gera `dist/` com `auth/`, `users/` e demais módulos.

---

Última atualização: Sessão 7 — Deploy on-prem (Hyper-V + Ubuntu Server, LAN interna) com `Caddyfile.internal`, override de compose e walkthrough em `docs/deploy-onprem-hyperv.md`. Próximo passo: criar a VM no Hyper-V seguindo o doc, rodar `docker compose -f docker-compose.prod.yml -f docker-compose.onprem.yml up -d` lá dentro, e implementar as telas de Serviço Social (listagem + wizard) consumindo o CRUD da API.
