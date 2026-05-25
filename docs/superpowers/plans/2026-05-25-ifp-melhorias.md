# IFP Connect — Melhorias pós-Plano 4 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans ou subagent-driven-development. Steps usam checkbox (`- [ ]`).

**Goal:** Fechar as pontas soltas que a fatia estrutural do Plano 4 revelou — dar sentido real ao ciclo de vida do cidadão (edição + status), limpar débito (dashboards fake, push WSL, lixo de teste) e cumprir o §0.7 (draft).

**Architecture:** Trabalho incremental sobre a base existente (Next 16, Prisma 6, Auth.js v5). Padrão "pure core, I/O shell" + TDD onde há lógica. Sem mudança de stack. Uma migration só se necessário (status NÃO precisa — campos já existem).

**Tech Stack:** Next.js 16, Prisma 6, Vitest (unit), Playwright (e2e), Tailwind v4.

**Regras de operação:** ritual pré-commit (`format && format:check && typecheck && lint && test`) antes de cada commit; commit atômico por tarefa; push fast-forward na `main` **via git Windows** (`git -C "C:\Users\Administrador\ifp-connect" push origin main`); comandos dentro do WSL.

---

## Fase A — Ciclo de vida (núcleo, maior valor)

### Task 1: Reconciliar o modelo de status do Cidadão

**Problema:** convivem dois "status" com a palavra "ativo" ambígua: `statusCadastro` (ciclo de vida: rascunho/ativo/inativo) e o derivado de `deletedAt`/`anonimizadoEm` (lista usa `"ativo"|"anonimizado"|"deletado"`). **Recomendação (Opção A):** tratar como dois eixos ORTOGONAIS — ciclo de vida (`statusCadastro`) × flags de compliance (`deletedAt`/`anonimizadoEm`) — e um helper puro de display com precedência. SEM migration (campos já existem).

**Files:**

- Create: `src/lib/cidadao-status.ts` (helper puro)
- Test: `tests/unit/cidadao-status.test.ts`
- Modify: `src/app/app/cidadaos/[id]/page.tsx` (badge no header)
- Modify: `src/app/app/cidadaos/page.tsx` (filtro de ciclo de vida + badge na tabela)

- [ ] **Step 1: Teste do helper (RED).** `statusDisplay({deletedAt, anonimizadoEm, statusCadastro})` → `{label, tone}`. Precedência: deletado > anonimizado > statusCadastro.

```ts
import { describe, expect, it } from "vitest";
import { statusDisplay } from "@/lib/cidadao-status";

describe("statusDisplay", () => {
  it("deletado tem precedência sobre tudo", () => {
    expect(
      statusDisplay({ deletedAt: new Date(), anonimizadoEm: new Date(), statusCadastro: "ativo" })
        .label,
    ).toBe("Excluído");
  });
  it("anonimizado vem antes do ciclo de vida", () => {
    expect(
      statusDisplay({ deletedAt: null, anonimizadoEm: new Date(), statusCadastro: "ativo" }).label,
    ).toBe("Anonimizado");
  });
  it("sem flags, mostra o ciclo de vida", () => {
    expect(
      statusDisplay({ deletedAt: null, anonimizadoEm: null, statusCadastro: "rascunho" }).label,
    ).toBe("Rascunho");
    expect(
      statusDisplay({ deletedAt: null, anonimizadoEm: null, statusCadastro: "ativo" }).label,
    ).toBe("Ativo");
    expect(
      statusDisplay({ deletedAt: null, anonimizadoEm: null, statusCadastro: "inativo" }).label,
    ).toBe("Inativo");
  });
});
```

- [ ] **Step 2:** Rodar `pnpm exec vitest run tests/unit/cidadao-status.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3: Implementar** `statusDisplay` (pure): precedência + map de `tone` (`deletado`→red, `anonimizado`→amber, `rascunho`→slate, `ativo`→emerald, `inativo`→slate).
- [ ] **Step 4:** Rodar teste → PASS.
- [ ] **Step 5: UI** — badge `statusDisplay` no header do detalhe (ao lado dos badges Excluído/Anonimizado existentes, substituindo a duplicação) + coluna/badge na tabela da lista + adicionar opção de filtro "Rascunho/Ativo/Inativo" (ciclo de vida) ao form GET da lista (`statusCadastro` query param → filtro Prisma).
- [ ] **Step 6:** Ritual + `pnpm build`.
- [ ] **Step 7: Commit** `refactor(cidadao): reconcilia status (ciclo de vida x flags LGPD) + badge` + push Windows.

### Task 2: Edição de ficha (ativa `ficha_updated` + redação na timeline)

**Problema:** botão "Editar" está `disabled`; sem edição, a lógica de `ficha_updated` + redação de campo sensível (Refinement B do P3) está morta. **Recomendação:** reusar o form tabbed (`NovoCidadaoForm`) em modo edição (DRY) + `updateCidadaoAction` que faz diff de `changedFields` e emite `ficha_updated`.

**Files:**

- Modify: `src/app/app/cidadaos/novo/form.tsx` (parametrizar: `mode`, `initialValues`, action injetada, label do submit)
- Create: `src/app/app/cidadaos/[id]/editar/page.tsx` (server: getCidadao + RBAC + render form em edit)
- Modify: `src/app/app/cidadaos/novo/actions.ts` (add `updateCidadaoAction`) ou novo `edit-actions.ts`
- Create: `src/lib/cidadao-diff.ts` (puro: `changedFields(antigo, novo)`)
- Test: `tests/unit/cidadao-diff.test.ts`; `tests/e2e/cidadao-edit.spec.ts`
- Modify: `src/app/app/cidadaos/[id]/page.tsx` (habilitar botão Editar → link)

- [ ] **Step 1: Teste puro do diff (RED).** `changedFields(antigo, novo)` → string[] dos campos que mudaram.

```ts
import { describe, expect, it } from "vitest";
import { changedFields } from "@/lib/cidadao-diff";

describe("changedFields", () => {
  it("retorna só os campos alterados", () => {
    const a = { nomeCompleto: "Ana", telefonePrincipal: "111", alergias: "nenhuma" };
    const b = { nomeCompleto: "Ana", telefonePrincipal: "222", alergias: "dipirona" };
    expect(changedFields(a, b).sort()).toEqual(["alergias", "telefonePrincipal"]);
  });
  it("lista vazia quando nada muda", () => {
    expect(changedFields({ x: "1" }, { x: "1" })).toEqual([]);
  });
});
```

- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar `changedFields` (compara chaves comuns, normaliza null/undefined/"").
- [ ] **Step 4:** Rodar → PASS.
- [ ] **Step 5: Parametrizar o form.** `NovoCidadaoForm` → aceitar `{ mode: "create"|"edit", initialValues?, submitLabel }` e a action por prop (ou um wrapper). `INITIAL_STATE` parte de `initialValues` quando edit. CPF read-only em edit (é a chave).
- [ ] **Step 6: `updateCidadaoAction`** — valida (zod, sem unicidade de CPF pois é o mesmo), busca atual, calcula `changedFields`, atualiza, `logEvent({ action: "ficha_updated", entityType:"cidadao", entityId, rootEntityType:"cidadao", rootEntityId:id, meta:{ changedFields } })`. RBAC: `can(session,"edit","ficha_cidada",{unitScope})`.
- [ ] **Step 7: Página `editar`** + habilitar botão no detalhe.
- [ ] **Step 8: e2e** `cidadao-edit.spec.ts`: (a) gestor_geral edita telefone → detalhe reflete; (b) gestor_geral edita um campo de Saúde → no histórico, `recepcao` NÃO vê o nome do campo (redação Refinement B ativa), gestor_geral vê. Reusa `getByLabel` (form já acessível).
- [ ] **Step 9:** Ritual + build + e2e (kill server bracket + build + test:e2e).
- [ ] **Step 10: Commit** `feat(cidadao): edição de ficha + ficha_updated na timeline (ativa redação)` + push.

---

## Fase B — Higiene

### Task 3: Resolver o push do WSL (investigativo)

**Recomendação:** testar SSH do WSL→GitHub; se funcionar (escapa do wslrelay), trocar o remote pra SSH; senão, manter HTTPS + documentar/automatizar o push pelo Windows.

- [ ] **Step 1:** `wsl -d Ubuntu -- bash -c "timeout 15 ssh -T git@github.com 2>&1"` — checar se autentica (precisa de chave SSH no GitHub). Se "successfully authenticated" rápido → SSH viável.
- [ ] **Step 2a (se SSH ok):** `git remote set-url origin git@github.com:kiizinbr/kiizinbr-ifp-familiaponcio.git`; testar `git push` do WSL; se passar, atualizar memória/README.
- [ ] **Step 2b (se SSH falha/trava):** manter HTTPS; adicionar `package.json` script `"push:win"` documentando o push Windows + nota no README "Troubleshooting > push WSL". NÃO mexer em credenciais.
- [ ] **Step 3: Commit** `chore: resolve/documenta push do WSL` + push.

### Task 4: Limpeza de dados de teste e2e

**Problema:** cada e2e cria cidadãos reais ("Teste E2E…", "Triagem E2E…") que acumulam no banco de dev.

**Files:** Create `tests/e2e/_teardown.ts` (global teardown) + `playwright.config.ts` (globalTeardown).

- [ ] **Step 1:** Teardown que apaga (hard delete via Prisma) cidadãos com `nomeCompleto startsWith "Teste E2E"` ou `"Triagem E2E"` + suas triagens/elegibilidades/audit (cascade onde houver). Conecta via DATABASE_URL.
- [ ] **Step 2:** Registrar `globalTeardown` no `playwright.config.ts`.
- [ ] **Step 3:** Rodar `pnpm test:e2e` → confirmar que após, os registros de teste sumiram (psql count).
- [ ] **Step 4: Commit** `test: teardown limpa cidadãos de e2e do banco` + push.

### Task 5: Salvamento parcial (draft) no cadastro — §0.7

**Problema:** spec §0.7 previa "draft automático após Identificação válida"; o form só salva no submit completo.

- [ ] **Step 1:** Após Identificação válida (nome+cpf+dataNasc preenchidos e CPF válido), criar o cidadão com `statusCadastro: "rascunho"` automaticamente (debounced), guardando o id retornado; submits seguintes viram update. RBAC igual ao create.
- [ ] **Step 2:** e2e: preencher só Identificação, trocar de aba, voltar — rascunho persistiu (aparece na lista filtrando "Rascunho").
- [ ] **Step 3:** Ritual + build + e2e. **Step 4: Commit** + push.

> **Nota:** Task 5 dá sentido real ao `statusCadastro` rascunho→ativo (hoje todo cadastro nasce ativo). Conecta com a Task 1 (filtro rascunho) e com a triagem (que promove pra ativo).

---

## Fase C — Dashboards (dados agora; visual após aval do Erick)

### Task 6: Dados reais nos dashboards Global e de Unidade

**Problema:** `/app` (global) e `/app/[unit]` têm KPIs/agenda/destaques hardcoded (números fake ao lado de dados reais).

- [ ] **Step 1:** `/app` global — trocar KPIs fake por reais (total cidadãos, ativos, triagens abertas, por unidade) via `getCidadaoStats` + `countTriagensAbertas`. Manter só o que tem fonte real; o resto, ocultar ou rotular "exemplo".
- [ ] **Step 2:** `/app/[unit]` — os KPIs/agenda/destaques sem fonte real → rotular explicitamente como "dados de exemplo" (placeholder honesto) até termos a fonte; manter o painel real "Encaminhamentos da triagem" (já feito).
- [ ] **Step 3:** Ritual + build. **Step 4: Commit** `feat(dashboards): dados reais no global + placeholders honestos na unidade` + push.

> **Visual:** o passe `frontend-design` pra unificar a linguagem (cantos 2xl, laranja, cor por unidade, jornada) nos dashboards fica **aguardando o aval do Erick** sobre a direção do preview da triagem. Não executar o redesign visual sem o "ok".

---

## Self-Review

- **Cobertura:** itens 1–6 das recomendações → Tasks 1–6. ✅
- **Sem placeholders:** código real nos steps de lógica (helpers, diff, teardown). ✅
- **Consistência de tipos:** `statusDisplay`/`changedFields`/`statusCadastro` usados de forma consistente. ✅
- **Migration?** Nenhuma necessária (campos já existem). ✅
- **Decisão pro Erick:** Task 1 (eixos ortogonais de status) e Task 2 (reuso do form em edit) são minhas recomendações — confirmar antes de executar a Fase A.
