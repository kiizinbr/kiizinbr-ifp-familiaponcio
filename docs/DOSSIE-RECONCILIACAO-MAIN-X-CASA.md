# Dossiê de Reconciliação — `main` × branch CASA

> Gerado por agente de análise em 2026-06-10. Duas linhas SEM ancestral comum:
> `origin/main` (314 commits, sessões do Erick no servidor) e
> `claude/continue-projetoifp-section-10-RKC1n` (55 commits, união Connect/CASA).
> Este documento fundamenta a decisão sobre o futuro do repo.

## 1. O que a `main` É

- **Monolítico Next.js 16** (App Router, React 19), Prisma 6 + PostgreSQL, ~44 modelos.
- **Auth.js 5.0-beta** (credentials, adapter Prisma) · RBAC rico: `User` + `UserRole` + `Role`
  (6 roles com `unit_scope` opcional).
- **Motor de agenda (a joia):** core *resource-agnostic* (`lib/agenda/core.ts`) com
  `gerarSlots()`, máquina de estados, `reservarCAS()` (anti-overbooking transacional),
  **slot ad-hoc / walk-in** — construído em TDD bite-sized.
- **Médico (F1.B.1):** agenda anti-overbooking, SOAP + CID-10, vitais com selo,
  prontuário imutável, **receita/atestado em PDF**, painel TV com TTS.
- **Capacitação (F3):** matrícula com lock transacional, presença idempotente (IDOR guard),
  evasão, **certificado verificável com QR**.
- **Serviço Social:** Cidadão/Familiar/DadosSocio, consentimento LGPD **versionado**,
  documentos em MinIO, entrevistas.
- **Migração Amplimed → IFP:** runbook T1-T15 com validador, dedup, MinIO —
  **47 profissionais já transportados; produção mirada para 2026-06**.
- Vitest + Playwright instalados; design kit canônico em `docs/design-kit/` (tokens + scaffolds HTML).

## 2. Sobreposição (resumo)

| Funcionalidade | main | branch CASA | Mais maduro |
|---|---|---|---|
| Stack | Next 16 monolítico | Monorepo Turbo (NestJS+Next 14) | arquitetura: branch · estabilidade: main |
| Motor de agenda | core genérico TDD + walk-in | agenda simples | **main** |
| Prontuário SOAP | SOAP+CID+vitais+atestado PDF | SOAP+CID+vitais | **main** (polish) |
| Capacitação | locks transacionais + IDOR guard + cert QR | fluxo completo + lista de espera + cert QR/PDF | empate técnico |
| Design aplicado | só tokens/scaffolds (kit) | **CASA integrado nas telas** | **branch** |
| E2E | suporte genérico | **2 specs cobrindo as verticais** | **branch** |
| Hub/dashboards | home única + 403 | hub por perfil + KPIs | **branch** |
| LGPD consentimento | **versionado** | ausente | **main** |
| Migração Amplimed | **pronta (T1-T15)** | ausente | **main** |

## 3. Incompatibilidades estruturais

- **Arquitetura:** monolítico vs monorepo — sem merge limpo possível.
- **Schema:** `Cidadao`/`Familiar`/`UserRole`+`Role` (main) vs
  `FichaCidada`/`MembroFamiliar`/`UsuarioPerfil` enum (branch) — equivalentes em
  conceito, divergentes em forma; RBAC é breaking.
- **Auth:** NextAuth+adapter (main) vs NestJS JWT (branch) — incompatíveis.
- **Paths:** `prisma/` (main) vs `packages/database/` (branch); migrations separadas.

## 4. Estratégias

**A) `main` como base; portar CASA + E2E pra ela — esforço M (3-4 semanas)**
- ✅ preserva o motor de agenda e a migração Amplimed (produção em ~30 dias)
- ✅ mudanças aditivas (tema CASA por cima do design kit, cherry-pick dos E2E)
- ❌ continua monolítico por ora; hub/dashboards a portar

**B) Branch CASA vira a nova main; portar o motor — esforço XL (8-10 semanas)**
- ✅ melhor arquitetura final (monorepo, NestJS)
- ❌ reescrever motor de agenda, RBAC, auth; **refazer a migração Amplimed**; risco no prazo de produção

**C) Linhas separadas com fronteira (main=produção, branch=design/staging) — M agora, XL depois**
- ✅ zero risco imediato; Amplimed sai no prazo
- ❌ divergência cresce, correções em dobro, reconciliação futura pior

## 5. Recomendação do dossiê

**Estratégia A**, em 3 passos:
1. **Semana 1:** validar o motor em staging com dados Amplimed (go/no-go).
2. **Semanas 2-3:** aplicar tema CASA declarativamente na main + cherry-pick/adaptar os
   E2E da branch + dashboards/hub.
3. **Semana 4+:** com produção estável, refatorar para monorepo (fase 2) usando a
   branch CASA como referência arquitetural e visual.

**Síntese:** main = linha de produção (motor + Amplimed). Branch CASA = linha de
design/UX + E2E. Integrar o segundo no primeiro é o caminho de menor risco
com o prazo de produção de junho.
