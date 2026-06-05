# Auditoria Geral — IFP Connect

**Data:** 2026-06-05
**Método:** frota de 9 agentes especializados em paralelo (arquitetura, segurança, banco, frontend, a11y, qualidade/TS, testes, ops/LGPD) + síntese priorizada — read-only, ~470 leituras de arquivo.
**Pedido (Erick):** releitura geral do projeto pra achar o que **melhorar** (débito/risco) antes de escolher o próximo plano.
**Decisão tomada:** executar o **Sprint de Endurecimento** (este doc, §7) ANTES de abrir F1.C Esportivo.

---

## 1. Veredito

IFP Connect é incomumente maduro para o estágio (216 commits, MVP/staging): arquitetura server-actions coesa, máquinas de estado tipadas e transacionais, `strict` TS pleno com zero erros, audit log append-only, Design Kit já integrado, equipe honesta sobre os limites (banner STAGING, doc LGPD "não usar com dado real").

**Tese central:** o código de _feature_ está à frente do código de _proteção_. A plataforma já trata dados de **saúde e socioeconômicos de pessoas vulneráveis**, mas as fundações de proteção desse dado ainda vazam. **Não avançar nova vertical antes de pagar o núcleo de proteção** — e ~60% do risco alto se resolve com esforço S/M concentrado.

## 2. Scorecard por dimensão

| Dimensão                         |   Nota   | Em uma linha                                                                  |
| -------------------------------- | :------: | ----------------------------------------------------------------------------- |
| Arquitetura                      |   8/10   | Server-actions coeso, state machines tx-aware, nada >800 linhas               |
| TypeScript / Qualidade           |   8/10   | Strict + zero erro + zero `any`; tropeça em `catch{}` mudo e FormData sem Zod |
| Banco / Prisma                   |   7/10   | Tipos certos, cursor pagination, anti-overbooking; índice trigram caiu        |
| Frontend (React)                 |   7/10   | Server-first exemplar, Design Kit bem adotado                                 |
| Acessibilidade (WCAG 2.2)        |   6/10   | Boa base; falta skip-link, sidebar some no mobile, contraste `--text-3`       |
| Testes & cobertura               |   6/10   | 3 camadas exemplares; sem gate de 80%, E2E com `\|\|echo`                     |
| Segurança                        |   5/10   | bcrypt/zod ok; sem middleware, sem rate-limit, CSP ausente                    |
| Ops / Deploy / DR                |   5/10   | Rede correta, backup existe; sem cripto/restore testado/observabilidade       |
| **Proteção de dados (PHI/LGPD)** | **3/10** | **Ponto mais fraco — e o que mais importa nesse domínio**                     |

## 3. Bugs silenciosos JÁ na base (confirmados)

1. **Busca de cidadão quebrada.** Migration `20260524234544_add_audit_root_entity` dropa os 4 índices GIN trigram criados em `20260524180000_add_trigram_indexes` e nunca recria → busca fuzzy (CPF/nome/telefone) em seq-scan `ILIKE`. Fix: 1 migration `_raw`, risco ~zero.
2. **Estado "ao vivo" da fila nunca pinta.** `src/app/medico/page.tsx:189` — `` `tl-item${isNow?"live":""}` `` gera `tl-itemlive` (sem espaço); seletor `.tl-item.live` (`ifp-components.css:552`) nunca casa. Fix: espaço ou `clsx`.
3. **Credencial de dev vaza pra prod.** `src/lib/env.ts:15-16` — `.default('ifp_minio')` / `.default('ifp_minio_dev_pw')`: sem env em prod, sobe com senha de dev sem erro. Fix: remover `.default()`.
4. **Race de overbooking na matrícula.** `src/lib/capacitacao/matricula.ts` faz count-then-create sem lock (o próprio teste admite o gap), enquanto `reservarSlot` (`src/lib/medico/agenda.ts:113-140`) já resolve com compare-and-swap.

## 4. Achados por dimensão (resumo + principais)

### 4.1 Arquitetura — 8/10

- **[high]** Race de overbooking na matrícula (`matricula.ts:90-105,138-157`) — replicar o compare-and-swap de `reservarSlot`.
- **[high]** Validação zod só na Ficha; `capacitacao/actions.ts:73` e `medico/consultas/nova/actions.ts:16-21` passam input cru.
- **[medium]** Verticais duplicam `rbac/nav/ui` sem registry de domínio (`medico/*` vs `capacitacao/*`); shells idênticos.
- **[medium]** `UNIT_SCOPES` (4) diverge de `UNIDADE_SLUGS` (6) forçando casts `as UnitScope` (`route.ts:28`, `funil.ts:66`, `triagem.ts:78`).
- **[medium]** Inline styles pesados (`app-shell.tsx:87-130`, `medico-shell.tsx:44-77`) contrariam "100% Design Kit".
- **Forças:** state machines tx-aware sem aninhar transação; pure core / I/O shell; imutabilidade respeitada; audit append-only que não derruba o fluxo; 108 arquivos <800 linhas.

### 4.2 Segurança — 5/10

- **[high]** Sem `src/middleware.ts` — auth roda dentro do RSC, sem barreira no edge.
- **[high]** `getCidadao()` (`src/lib/cidadao.ts:136-151`) retorna PHI+socio em bloco; separação só no JSX (`cidadaos/[id]/page.tsx:65-66`).
- **[high]** `updateCidadaoAction()` (`cidadaos/novo/actions.ts:141-169`) grava saúde sem checar permissão-PHI — recepção escreve dado clínico.
- **[high]** Zero rate-limit nos 2 fluxos de login.
- **[high]** CSP ausente (`next.config.ts:5-8`).
- **[medium]** `X-Frame-Options: SAMEORIGIN` (deveria ser DENY); `storageKey` de anexo não validado contra `cidadaoId` (IDOR parcial em `anexo-actions.ts:94-146`); next-auth 5 beta em prod; presigned URL via redirect 302 vaza em log; defaults de credencial MinIO; `/reset` é stub; postcss CVE.
- **[low]** Audit não loga leitura de PHI (`audit.ts:87-88`) — rastreabilidade LGPD.
- **Forças:** bcrypt + zod nas credenciais; todas as actions checam sessão+role; env validado no boot; SQL injection impossível (Prisma); nota assinada imutável; upload com validação tripla + anti-tamper.

### 4.3 Banco / Prisma — 7/10

- **[high]** Migration `20260524234544` dropa índices trigram sem recriar (bug #1).
- **[high]** N+1: criação de template faz upsert por slot em loop (`minha-agenda/actions.ts:60-78`) — ~720 round-trips → usar `createMany({skipDuplicates:true})`.
- **[high]** Fila do dia (`medico/page.tsx:43-56`) parte de Consulta sem índice de cobertura — inverter pra `slot.findMany`.
- **[high]** Zero RLS no Postgres — isolamento multi-tenant 100% em código TS.
- **[medium]** FKs sem índice: `createdBy`/`origemTriagemId`/`origemEncaminhamentoId`, `AgendaTemplate.especialidadeId`, `Encaminhamento.consultaOrigemId`, `ProfissionalEspecialidade.especialidadeId`.
- **[medium]** Soft-delete inconsistente; listagem de cidadão sem índice parcial; `Cid10.descricao` B-tree (deveria trigram); busca de nova consulta sem `anonimizadoEm: null`.
- **Forças:** tipos corretos (Decimal/Date), enums nativos, `onDelete` intencional, cursor pagination, anti-overbooking transacional, `buildCidadaoSearchFilter` evita `LIKE '%%'`.

### 4.4 Frontend (React) — 7/10

- **[high]** `eslint-plugin-react-hooks` ausente — sem lint de hooks.
- **[high]** `dangerouslySetInnerHTML` no site (`page.tsx:29`) — build-time, baixo risco, mas documentar/sanitizar.
- **[high]** `_blank` sem `noreferrer` (`site-content.ts:338,361,364`).
- **[high]** Bug `.tl-item` sem espaço (bug #2).
- **[medium]** Hardcodes de cor fora dos tokens (`unit-switcher.tsx:40`, `#fff` em páginas); KitBadge/PageHead duplicados; sem error boundary por segmento; `/poncio` sem AppShell; selects sem label.
- **Forças:** `globals.css` **já importa** os tokens (CLAUDE.md desatualizado); server-first exemplar; fronteira `use client` cirúrgica; shells thin; Input com `useId`+`htmlFor`; AnexoUploader com `useTransition`.

### 4.5 Acessibilidade (WCAG 2.2) — 6/10

- **[critical]** Sem skip-navigation link em telas autenticadas (`app-shell.tsx:69`).
- **[high]** UnitSwitcher `role=menu` sem foco/Arrow/Escape; botão `.is-loading` não anuncia (`aria-busy`); reduced-motion ignorado de propósito no leão (`site.js:10-11`) — viola 2.3.3 + risco fotossensível; tabs do form de cidadão sem `role=tablist/tab/tabpanel`; `*` obrigatório e ponto de erro só visuais.
- **[medium]** Sidebar `display:none` no mobile sem alternativa; `--text-3` (#82888a) falha contraste 4.5:1 no claro; busca/stepper sem label/`aria-current`.
- **Forças:** `lang=pt-BR`; labels via `useId`; `aria-current=page`; `role=alert` em erros; `:focus-visible`; reduced-motion global no app.

### 4.6 TypeScript / Qualidade — 8/10

- **[high]** Bare `catch{}` engole falha real: `capacitacao/actions.ts:134` e `prontuario-actions.ts:115`.
- **[high]** Server actions de FormData sem zod (`consultas/nova/actions.ts:16-21`, `minha-agenda/actions.ts`); cast cego `as StatusMatricula`.
- **[high]** `action as never` (`consultas/[id]/actions.ts:39`) mascara tipo — tipar `ACTION_MAP` como `Partial<Record<StatusConsulta, AuditAction>>`.
- **[high]** Defaults de credencial dev em `env.ts` (bug #3).
- **[medium]** Casts `as UnitScope`/`as RoleName` sem type guard; double cast em `updateCidadaoAction`.
- **[low]** `.claude/scripts` fora do `ignores` do eslint → `pnpm lint` falha.
- **Forças:** `strict + noUncheckedIndexedAccess`, zero erro, zero `any`; state machines tipadas; erros de domínio como classes nomeadas.

### 4.7 Testes & cobertura — 6/10

- **[critical]** Sem gate de cobertura (`vitest.config.ts` sem bloco coverage; `@vitest/coverage-v8` instalado, sem uso) — 80% ECC não é verificável.
- **[high]** E2E com gate fraco no CI (`ci.yml:72` `|| echo`); `minio.ts`/`cep.ts`/`cidadao-schema.ts` sem cobertura; server actions sem teste; fluxo prontuário E2E (assinatura) ausente.
- **[medium]** `rbac.spec.ts` usa login global v1 (rota possivelmente morta); fixtures sem verificação de seed; `auth.ts` JWT callback sem teste; zero teste de componente.
- **Forças:** 3 camadas (puro/mock/E2E) em todo o domínio; teste de race real do `reservarSlot`; CI com Postgres real; 20 unit + 12 e2e.

### 4.8 Ops / Deploy / DR — 5/10

- **[high]** Direito ao esquecimento / anonimização só no schema — nenhuma função em `src/` escreve `anonimizadoEm`.
- **[high]** Sem consentimento versionado/ROPA (2 booleanos); backup sem cripto e sem restore testado.
- **[high]** CSP ausente; login sem rate-limit.
- **[medium]** Retenção de audit indefinida; `deploy.sh` roda `migrate deploy` sem backup prévio; sem observabilidade/healthcheck do app; RLS ausente; betas sem pin/CVE watch.
- **[low]** CLAUDE.md desatualizado (tokens); senha demo no seed; MinIO sem TLS interno.
- **Forças:** topologia de rede correta (sem ports, atrás de Tailscale Funnel); Dockerfile multi-stage non-root; segredos fora do git/imagem; backup automatizado honesto sobre limites; hardening preparado com disciplina.

## 5. Top-prioridades (risco × esforço)

|  #  | Item                                                | Sev  | Esf. | Dimensão    |
| :-: | --------------------------------------------------- | :--: | :--: | ----------- |
|  1  | PHI/socio enforced na camada de dados (não no JSX)  | CRIT |  M   | PHI/LGPD    |
|  2  | `middleware.ts` no edge + rate-limit no login       | CRIT |  M   | Segurança   |
|  3  | Recriar índices trigram                             | HIGH |  S   | Banco       |
|  4  | Anonimização / direito ao esquecimento de verdade   | HIGH |  L   | PHI/LGPD    |
|  5  | `catch{}` mudo + Zod nas server actions             | HIGH |  M   | Qualidade   |
|  6  | Race de overbooking na matrícula                    | HIGH |  M   | Arquitetura |
|  7  | CSP por nonce + gate de cobertura 80% + healthcheck | MED  |  M   | Ops         |
|  8  | RLS no Postgres (rede de segurança multi-tenant)    | MED  |  L   | Banco       |

## 6. Quick wins (esforço S)

Recriar trigram · corrigir `.tl-item` · remover defaults MinIO · `catch` relançar inesperado · `X-Frame: DENY` · skip-link no AppShell · escurecer `--text-3` (4.5:1) · `eslint-plugin-react-hooks` + `jsx-a11y` · `coverage.thresholds:80` + tirar `||echo` do CI · validar `storageKey.startsWith(cidadaoId)` · atualizar CLAUDE.md (tokens já importados) · `.claude/scripts` no `ignores` do eslint · índices nas FKs · `createMany` no lugar do loop de upsert de slots.

## 7. Plano escolhido: Sprint de Endurecimento (antes de F1.C)

**Bloco A — quick wins (dias 1-2):** trigram, `.tl-item`, defaults MinIO, X-Frame DENY, skip-link, `--text-3`, eslint-hooks, coverage threshold + tirar `||echo`, `storageKey` startsWith, atualizar CLAUDE.md, índices de FK + `createMany` de slots.

**Bloco B — núcleo PHI (dias 3-6):** `getCidadaoView(id, session)` com `select` dinâmico por capability (enforcement na camada de dados); separar `updateCidadao` em básico/saúde/socio com checagem de escrita-PHI; tratar bare `catch` + schemas Zod nas actions críticas (consulta/template/matrícula/assinatura).

**Bloco C — barreira (dias 7-9):** `src/middleware.ts` de auth no edge com matcher por segmento; rate-limit no login logando `signin_failed`; CSP report-only → enforce.

**Bloco D — LGPD mínimo executável (dias 10-12):** server-action de anonimização real (mascara Cidadao/Familiar/Endereco + remove anexos MinIO via `removeCidadaoAnexo` + seta `anonimizadoEm` + audit) com testes do pure core; corrigir race de matrícula com teste de concorrência DB-real.

## 8. Decisões abertas a brainstormar (B/C/D)

- **Rate-limit store:** sliding window no Postgres (zero infra nova) vs Upstash/Redis (mais robusto).
- **CSP:** rollout report-only → enforce; inventariar fontes externas (Google Fonts, Wix/imagens do site).
- **`updateCidadao`:** uma action com gates por bloco vs actions separadas (`...Basico`/`...Saude`/`...Socio`).
- **Anonimização:** política de mascaramento (nulificar vs hash vs placeholder) e o que fazer com audit/MinIO; reversível? (não — LGPD).
- **Matrícula race:** `isolationLevel Serializable` + retry P2034 vs constraint condicional no banco.

## 9. Fora de escopo (Fase posterior dedicada)

RLS completo em todas as tabelas; consentimento versionado/ROPA; backup cifrado + restore testado; retenção de audit; migração de next-auth beta → GA; observabilidade plena (Sentry). Mapeiam para Fase 3 (LGPD operacional) e Fase 4 (produção) do roadmap.
