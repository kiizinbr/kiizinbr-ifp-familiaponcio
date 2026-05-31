# Overnight 2026-05-31 — Progresso & Checkpoint (RESUME-SAFE)

> **Documento vivo.** Atualizado após cada passo. Se a sessão cair (crédito / capacidade /
> WSL / classifier), QUALQUER sessão nova lê este arquivo e continua de onde parou.
> Trabalho concluído já está **commitado** (git = checkpoint durável).

**Repo:** `C:\Users\Administrador\ifp-connect` — branch `main`
**Base no início:** `c86b5a8`
**Decisões do Erick (2026-05-31):** specs = **ambos** (Prontuário + Capacitação); DO = **aplica + pusha main**; bug busca (achado #2) = **corrigir com teste**.
**Autorização:** overnight (linha de autoridade de decisão) + push direto main OK.

---

## Estado das tarefas

### ✅ Concluído

- [x] **Recon read-only** (5 dimensões) — triagem DO/PREPARE/DEFER (workflow `wubyxy6ab`).
- [x] **Specs DRAFT** (PREPARE, doc-only) — workflow `wi164zxu4`:
  - `docs/superpowers/specs/2026-05-31-f1b2-prontuario-design.md` (351 ln, §0 com 9 decisões)
  - `docs/superpowers/specs/2026-05-31-f1a1-capacitacao-design.md` (393 ln, §0 com 10 decisões)
- [x] **Fix achado #2 — busca Cidadãos** (TDD red→green): extraído `buildCidadaoSearchFilter` em `src/lib/cidadao.ts` + fix (cpf/telefone só com dígitos) + `tests/unit/cidadao-search.test.ts` (5 testes). **Unit 103/103 verde.**

### ⏳ Em andamento / RESUME HERE

- [ ] Confirmar **typecheck** verde (`pnpm typecheck`) — bloqueado por outage transitório do classifier de comandos (2026-05-31 ~01:56).
- [ ] **Commit #1**: fix busca + specs drafts (chunk lógico) → push.

### ⬜ Pendente — DO (aplicar + pushar)

- [ ] **Migração 7 e2e legacy** + helper `tests/e2e/helpers/login.ts`.
      Ordem: helper → `login` → `audit` → `cidadao-crud` → `cidadao-edit` → `triagem` → `funil` → `rbac` (o difícil).
      Padrão a copiar: `login(page,slug,email,senha)` de `medico-agenda.spec.ts:10-19` / `rbac-v2-multitenant.spec.ts:12-28`.
      Regra de landing já DECIDIDA em código (`login-action.ts:62-93`, `rbac.ts:121-134`) → migração é mecânica.
- [ ] **README**: 2 linhas stale (login per-unidade; `/app`→`/poncio`) + sweep `contains:""` read-only.
- [ ] **Verify final**: `pnpm test` (unit) + e2e contra build prod (WSL).

### ⬜ Pendente — PREPARE (preview, **NÃO aplicar**; held p/ OK de manhã)

- [ ] **P3** migration `@@unique` em `AgendaTemplate` (SQL pronto, não aplicar).
- [ ] **P4** seed Sarah Pôncio presidência (diff pronto, não aplicar).
- [ ] **P5** decision-aid das 6 direções de design (via `frontend-design`) — lab only.

### ⏸️ DEFER (não tocar)

- Construir Prontuário/Capacitação (precisa spec aprovada).
- Propagar design pras 8 telas (precisa escolha do Erick + sessão supervisionada).
- Cleanup rotas legacy `/app/*` + `/login` antigo; lint `tests/**`; TTL slots; fontes Garet / fotos drone (externos).

---

## Como retomar (qualquer sessão)

1. `cd C:\Users\Administrador\ifp-connect` ; `git log --oneline -8` (ver até onde commitou).
2. Ler este arquivo → seção **RESUME HERE**.
3. Ambiente: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm dev:up"`.
4. Verify CURTO (WSL recicla comandos longos!): `pnpm exec vitest run > /tmp/g.log 2>&1; echo RC=$?; tail -22 /tmp/g.log`.
5. Continuar a próxima caixa não-marcada; atualizar este doc + commitar ao concluir.

## Notas de ambiente desta noite

- **WSL instável:** comandos longos (>~30s, ex. typecheck+test juntos) são reciclados → rodar **curto**, log em `/tmp` + `tail` na MESMA chamada. `/tmp` não sobrevive entre chamadas (sessão recicla).
- **PowerShell `$?`** é expandido pelo PS em aspas duplas → usar **aspas simples** no comando `wsl`.
- **git push** = git nativo Windows (não WSL): `git -C "C:\Users\Administrador\ifp-connect" push origin main`.
- **Classifier de comandos** pode cair (transitório) → edições de arquivo seguem; batchar verificação/commit pra quando voltar.
