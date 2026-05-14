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
├── .nvmrc                         ✅ Node 20.18.0
├── .npmrc                         ✅ engine-strict, auto-install-peers
├── .prettierrc.json               ✅ Prettier + plugin Tailwind
├── .prettierignore                ✅
├── package.json                   ✅ root do monorepo (scripts turbo, prettier, ts)
├── pnpm-workspace.yaml            ✅ workspaces apps/* e packages/*
├── turbo.json                     ✅ pipeline (build, dev, lint, typecheck, db:*)
├── tsconfig.base.json             ✅ TS strict compartilhado
├── apps/
│   ├── web/
│   │   ├── package.json           ✅ @ifp/web (Next.js 14, RHF, zod, RQ)
│   │   └── tailwind.config.ts     ✅ tokens IFP
│   └── api/
│       └── package.json           ✅ @ifp/api (NestJS 10, Prisma, BullMQ, JWT)
├── packages/
│   ├── ui/
│   │   ├── package.json           ✅ @ifp/ui (cva, clsx, lucide)
│   │   └── src/index.ts           ✅ placeholder de exports
│   ├── design-tokens/
│   │   ├── package.json           ✅ @ifp/design-tokens (export ./tokens.css)
│   │   └── tokens.css             ✅ paleta + tipografia + temas por unidade
│   └── database/
│       ├── package.json           ✅ @ifp/database (Prisma 5, tsx p/ seed)
│       ├── src/index.ts           ✅ PrismaClient singleton + re-export
│       └── schema.prisma          ✅ Ficha Cidadã + RBAC + AuditLog
└── docs/
    └── .gitkeep                   ✅ placeholder (documentação técnica pendente)
```

Versões pinadas (engines): Node ≥ 20.11, pnpm ≥ 9. Stack: Next 14.2, NestJS 10.4, Prisma 5.18, Tailwind 3.4, Turbo 2.1, TS 5.5.

PENDENTE no monorepo (próxima sessão): `pnpm install` (gera `pnpm-lock.yaml`), bootstrap real do Next.js (`app/`, `globals.css`, layout, fonts/Garet), bootstrap real do NestJS (`src/main.ts`, módulos auth/users/tenants/fichas), seed do Prisma com 4 Unidades + Super Admin.

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

### Próximos passos (próxima sessão)

1. **Instalar dependências e gerar lockfile**: `pnpm install` na raiz; verificar resolução de workspaces e `@prisma/client`.
2. **Bootstrap do Next.js** em `apps/web`: criar `app/layout.tsx`, `app/page.tsx`, `app/globals.css` importando `@ifp/design-tokens/tokens.css`, `next.config.mjs`, `tsconfig.json` (estendendo `tsconfig.base.json`), `postcss.config.mjs`. Configurar fonte Garet localmente em `apps/web/app/fonts/` (pendente arquivos do Erick — usar Inter como fallback).
3. **Bootstrap do NestJS** em `apps/api`: `src/main.ts`, `src/app.module.ts`, `nest-cli.json`, `tsconfig.json` (estendendo o base), Helmet + ValidationPipe + Swagger. Módulos iniciais: `auth`, `users`, `tenants`, `fichas-cidadas`.
4. **Setup completo do Prisma**: gerar client (`pnpm db:generate`), criar primeira migration a partir do `schema.prisma`, `prisma/seed.ts` populando as 4 Unidades + Super Admin.
5. **Auth.js** em `apps/web` com login por e-mail/senha (bcrypt) + magic link (Resend). Sessão JWT compartilhada com a API.
6. **Telas iniciais do Serviço Social**:
   - Login + dashboard
   - Listagem de fichas com filtro por status
   - Wizard de nova Ficha Cidadã (etapa 1: titular; etapa 2: composição familiar; etapa 3: socioeconômico; etapa 4: documentos; etapa 5: consentimentos LGPD; etapa 6: avaliação de elegibilidade por unidade)
7. **Row-Level Security no Postgres**: policies por `unidadeId` após primeira migration.
8. **Layout base com troca de tema por unidade** (`data-theme` no html).
9. **Logo SVG e fonte Garet**: pedir ao Erick os arquivos vetoriais e tipográficos para colocar em `apps/web/public/` e `apps/web/app/fonts/`.

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

---

Última atualização: Sessão 2 — monorepo configurado (pnpm + Turbo), versões dos pacotes pinadas em todos os workspaces. Próximo passo: rodar `pnpm install` e bootstrappar Next.js + NestJS.
