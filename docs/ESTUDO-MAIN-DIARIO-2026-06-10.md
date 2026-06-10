# Diário — estudo autônomo da `main` (Estratégia A, passo 1)

> Erick saiu dirigindo (internet vai cair) e autorizou seguir de forma autônoma,
> read-only, documentando tudo. Objetivo: **estudar a `main` a fundo** antes de
> qualquer integração, e produzir o estudo + o plano de portabilidade do CASA.
> Regras: SÓ leitura da main (worktree isolada), nada de push na main, commits de
> documentação na branch CASA, push pra ele ver no GitHub ao chegar.

## Setup
- Worktree da `origin/main` (detached @ 74a992d) em `C:\Users\Erick\Documents\GitHub\ifp-main-study`.
- Branch de trabalho (CASA): `claude/continue-projetoifp-section-10-RKC1n`.

## Plano
| # | Etapa | Status |
|---|---|---|
| 1 | Worktree da main + verificação de estrutura | ✅ |
| 2 | Estudo profundo (workflow: 5 leitores paralelos) | 🔄 |
| 3 | Doc `ESTUDO-MAIN.md` — estado real da main, maturidade por módulo, como roda, e quais dos 23 achados de segurança a main já trata | ✅ |
| 4 | Doc `PLANO-PORTABILIDADE-CASA-PARA-MAIN.md` — passo a passo file-by-file de levar tema CASA + E2E + dashboards pra main | ✅ |
| 5 | Commit + push de tudo | ✅ |

## Registro
- Worktree criada e validada (schema.prisma, vitest, playwright presentes). Workflow de estudo disparado.
- **Estudo concluído** (6 agentes). Achados-chave da main que refinam o dossiê:
  - **Stack:** Next.js 16 (App Router/Turbopack) + React 19, Prisma 6 + Postgres (porta **5433**, pra não bater no Alterdata/Bimer 5432), Auth.js 5 (JWT), MinIO, `@react-pdf/renderer`. **Não é monorepo** — pacote único. Ambiente de referência: **WSL2**.
  - **Motor de agenda = joia confirmada:** `agenda/core.ts` resource-agnostic (zero Prisma), anti-overbooking `reservarCAS` **provado por teste de 5 corridas concorrentes → 1 sucesso/4 falhas**. Walk-in/encaixe com 2 guards.
  - **RBAC em 4 camadas** (proxy.ts → canAccessUnidade → can() → regras de dono no médico); **7 roles** (o "6" do schema está desatualizado). Auditoria LGPD real (AuditLog append-only com rootEntity, IP/UA automático).
  - **Amplimed:** ETL idempotente **pronto e validado em dry-run (47 profissionais)**, mas **em HOLD aguardando o OK do Erick** pra rodar com `--commit`. Nunca rodou em prod.
  - **Design:** Tailwind 4 só base; o visual vem de um **CSS-kit semântico** (`.btn/.card/.shell`) — é nele que o tema CASA entra (não em utilitários).
  - **Segurança:** CSP está em **Report-Only** (não bloqueia ainda) — item de hardening. Vários dos 23 achados da CASA **já são tratados** na main pela defesa em camadas (detalhe no ESTUDO-MAIN.md §6).
- 2 docs gravados e pushados. **Worktree de estudo mantida** em `C:\Users\Erick\Documents\GitHub\ifp-main-study` (read-only; remover depois com `git worktree remove`).
- **Próximo passo (com o Erick):** revisar os 2 docs e escolher o 1º item do PLANO a portar — começando pelo que NÃO toca o motor de agenda nem a Amplimed.
