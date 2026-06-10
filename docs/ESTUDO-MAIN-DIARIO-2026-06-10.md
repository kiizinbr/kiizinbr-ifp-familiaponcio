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
| 3 | Doc `ESTUDO-MAIN.md` — estado real da main, maturidade por módulo, como roda, e quais dos 23 achados de segurança a main já trata | ⏳ |
| 4 | Doc `PLANO-PORTABILIDADE-CASA-PARA-MAIN.md` — passo a passo file-by-file de levar tema CASA + E2E + dashboards pra main | ⏳ |
| 5 | Commit + push de tudo | ⏳ |

## Registro
- Worktree criada e validada (schema.prisma, vitest, playwright presentes). Workflow de estudo disparado.
