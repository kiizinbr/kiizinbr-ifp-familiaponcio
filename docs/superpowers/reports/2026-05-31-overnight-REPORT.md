# Relatório noturno — 2026-05-31 (IFP Connect)

> **Branch:** `overnight/2026-05-31` (pushada em `origin`) · **base:** `c86b5a8` (main intocado)
> **Modo:** overnight (executa reversível+verificável; prepara o resto; nunca toca prod/main sozinho).
> Cada item ✅ passou **2 barreiras**: checagens do projeto (build/test/typecheck/lint) + **revisor independente** tentando refutar.

## Resumo em 1 linha
Suíte e2e saiu de **7 specs legacy mortos → 1** (rbac, deferido por decisão sua); 1 bug LGPD de busca corrigido; 2 rascunhos de spec prontos pra você escolher a direção. **103 unit + 39 e2e verdes.** main intocado — você revisa a branch e mergeia num comando.

---

## ✅ Executado e verificado (commits na branch)

### 1. Fix achado #2 — busca de Cidadãos retornava TODOS — `61fd67e`
- **O quê:** `listCidadaos` (tela global de Cidadãos, sensível LGPD) retornava **todos** os cidadãos quando você buscava por nome. Causa: `normalizeCpf("Maria") === ""` e `{ cpf: { contains: "" } }` / `{ telefonePrincipal: { contains: "" } }` viravam `LIKE '%%'`, casando toda linha no OR.
- **Como:** extraí `buildCidadaoSearchFilter` (função pura, testável) e gateei cpf/telefone em dígitos — espelha o fix já em prod no wizard de nova consulta. TDD red→green.
- **Evidência:** `tests/unit/cidadao-search.test.ts` (5 testes) · **unit 103/103** · typecheck + lint verdes · **revisor independente: HOLDS** (refutou em 7 eixos, sem defeito).
- **Semântica aplicada (você aprovou):** query vazia segue listando todos; nome filtra nome/nomeSocial; cpf/telefone só com dígitos. *Quiser outra → reverter é 1 comando.*
- **Reverter:** `git revert 61fd67e`.

### 2. Migração e2e legacy (6 de 7) — `dcf3b56`
- **O quê:** os specs legacy quebraram na migração RBAC v2 (usavam `/login` antigo → landing morta `/app`). Extraí helper compartilhado `tests/e2e/helpers/login.ts` (login por unidade) e migrei **6**: `login`, `audit`, `cidadao-crud`, `cidadao-edit`, `triagem`, `funil`.
- **Como:** trocou só o mecanismo de login (per-slug) + asserções mortas do `/app-landing`. Bodies `/app/*` e regras RBAC **intactos**. `audit`: senha errada agora = erro inline + `signin_failed` (sem redirect `/login?error`).
- **Evidência:** **build verde** + **39/39 e2e verdes** (23 migrados + 16 de referência) + typecheck + **revisor independente: 6/6 HOLDS** (caçou diluição de asserção; "39/39 green is earned"). −63 linhas líquidas (remove `loginAs` duplicados).
- **Reverter:** `git revert dcf3b56`.

### 3. Rascunhos de spec (DRAFT, doc-only) — `1642db0`
- `docs/superpowers/specs/2026-05-31-f1b2-prontuario-design.md` (351 ln, **§0 com 9 decisões clínicas abertas**)
- `docs/superpowers/specs/2026-05-31-f1a1-capacitacao-design.md` (393 ln, **§0 com 10 decisões abertas**)
- Não implementam nada — estruturam o problema e expõem as decisões que são suas. **Leia os §0 e escolha a direção** (ver 🟡 abaixo).

### 4. README — tabela de URLs pro mundo RBAC v2 + checkpoint resume-safe — `b7e5e5c` + commit deste relatório
- 3 linhas stale (login per-unidade; `/app`→`/poncio`) corrigidas. Doc-only.

---

## 🟡 Pronto pra 1 clique (precisa do seu OK)

### A. **Direção do produto** (a decisão que destrava a próxima noite)
Escolha **Prontuário F1.B.2** (aprofunda o Médico, placeholder já existe) **ou** **Capacitação F1.A.1** (recomendação do roadmap, valida o padrão vertical num escopo menor). Leia o **§0** de cada rascunho. Depois eu construo: backend TDD (ralph-loop) + UI (frontend-design).

### B. **rbac.spec.ts** — deletar redundante vs reescrever
Não migrei (deixei intocado). Os 3 blocos dele (Role-based landing, Bypass prevention, UnitSwitcher) testam o modelo **morto** `/app`, e o **`rbac-v2-multitenant.spec.ts` já cobre o mundo novo**. *Recomendação:* **deletar** os 2 blocos redundantes e **reescrever só os 4 testes de UnitSwitcher** contra o shell novo (se o switcher ainda existe lá). É decisão sua porque reduz cobertura. Me dá o OK e eu faço (verificável).

### C. **P3 — AgendaTemplate sem proteção de overlap** (o recon simplificou demais)
**Não é um `@@unique` trivial:** `diasSemana` é `Int[]` (Prisma não aceita lista em `@@unique`) e ranges de hora não pegam sobreposição. *Decisão:* o que conta como "conflito de template"? *Recomendação:* validação de overlap na *action* de criar template **ou** exclusion constraint GiST no Postgres. Não preparei migration porque uma ingênua estaria errada.

### D. **P4 — user Sarah Pôncio (presidência)**
Diff pronto (clone de Saulo). *Decisão:* seed-demo (idempotente, recriado a cada seed) vs **conta real via `/admin/users`** (o TODO do seed sugere real). Se for seed, adicione a `DEMO_USERS` em `prisma/seed.ts`:
```ts
{ email: "sarah@familiaponcio.org.br", name: "Sarah Pôncios", password: DEMO_PASSWORD,
  primaryRoleName: "presidencia", primaryUnitScope: null,
  roles: [{ roleName: "presidencia", unitScope: null }] },
```

### E. **P5 — decision-aid das 6 direções de design da Fila** (não construído)
Recomendado mas **não construído nesta noite** — é trabalho de UI e, pela sua regra, passa pelo `frontend-design` com preview→revisão; preferi não fazer um artefato apressado no fim da sessão. Me peça e eu monto o comparador lado-a-lado (lab-only, sem risco).

---

## ⏸️ Não-tocado / revertido (e por quê)
- **`public/lab/*.html` (8 telas):** o `pnpm format` reformatou as telas do design lab; **revertido** — são seus artefatos de design em revisão, fora do escopo.
- **`rbac.spec.ts`:** intocado (decisão B acima).
- **Construir Prontuário/Capacitação, propagar design, cleanup de rotas legacy, lint em `tests/**`, fontes/fotos:** DEFER (precisam decisão/supervisão/ativos externos).

---

## 📊 Achados (ranqueados por ROI)
1. **🔴→✅ Busca Cidadãos retornava todos (LGPD)** — alto impacto, baixo esforço. **CORRIGIDO.**
2. **🟠→✅ 7 e2e legacy mortos** — restaura confiança na suíte. **6 CORRIGIDOS**, 1 deferido (rbac).
3. **🟠 AgendaTemplate sem guarda de overlap** — médio impacto (templates sobrepostos geram slots redundantes), médio esforço. Ver 🟡 C.
4. **🟡 `tests/**` fora do ESLint** (`eslint.config.mjs` ignora) — é por isso que 2 pushes passados precisaram de fixup de prettier. Habilitar evita recorrência.
5. **🟢 Comentário stale** em `cidadao.ts:60` ("trigram/similarity>0.3") — o código usa ILIKE/`contains`, não trigram. Cosmético.

## 💡 Sugestões (brainstorm)
- **Dedup dos helpers de login:** `medico-agenda.spec` e `rbac-v2-multitenant.spec` ainda têm cópias locais do `login`; agora que existe o `tests/e2e/helpers/login.ts`, dá pra apontar as duas pra ele (pequeno, verificável — deixei pra não mexer em specs que passavam sem necessidade).
- **SSH pro GitHub** (já documentei no README): mata de vez o problema do `git push` travar no WSL.
- **Habilitar lint em `tests/**`** no mesmo PR de qualquer um dos acima.
- **Decision-aid de design (P5):** um comparador lado-a-lado das 6 direções + nota de "custo de implementação" (5 de 6 trocam a fonte Garet; Comando exige dark theme que o DS não tem) te faria escolher a Fila em segundos.

---

## Como aceitar / descartar
- **Ver o diff:** GitHub → branch `overnight/2026-05-31` (5 commits sobre `c86b5a8`), ou local `git checkout overnight/2026-05-31`.
- **Aceitar tudo:** `git checkout main && git merge overnight/2026-05-31 && git push origin main`
- **Aceitar seletivo:** `git cherry-pick <hash>` — `61fd67e` (fix busca), `dcf3b56` (e2e), `1642db0` (specs).
- **Descartar tudo:** `git branch -D overnight/2026-05-31` + `git push origin --delete overnight/2026-05-31`

## Notas de ambiente desta noite
- WSL recicla a sessão entre invocações (banner NAT + `/tmp` zerado); comando foreground completa, mas capturei resultados via `tail` na mesma chamada / arquivo persistente.
- Classifier de comandos teve outage transitório no meio — segui editando arquivos (não precisa do classifier) e batchei verificação/commit pra quando voltou. Ver [[feedback-overnight-resilience]].
