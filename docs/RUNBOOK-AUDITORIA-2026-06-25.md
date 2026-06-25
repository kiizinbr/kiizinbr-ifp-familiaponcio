# 🧭 RUNBOOK — Auditoria & Evolução do IFP Connect (2026-06-25)

> **Para quem executa:** siga as fases **na ordem**. Cada fase diz *qual agente/skill rodar*,
> *o que ele consome* e *o que ele produz*. A saída de uma fase alimenta a próxima.
> Este runbook **audita e planeja** — **não corrige nada sem OK do Erick** (ver Princípios).

---

## ⚠️ Princípios de execução (LER ANTES DE COMEÇAR)

1. **Read-mostly.** Este runbook gera *diagnóstico + backlog*. Não aplique correções nem mude
   schema/migrations sem o Erick aprovar. O entregável é um documento, não um PR.
2. **Todo achado de agente é um LEAD, não uma verdade.** Antes de virar tarefa, **verifique no
   código/rodando**. Marque cada item com `fonte:` e `status: verificado | suspeito`.
3. **Nunca rode contra a produção.** Produção = VM `ifp-final` (Tailscale `100.118.69.57`).
   Tudo aqui é **local** (Docker WSL2). Nada de migration destrutiva, seed em prod, ou apontar
   `WEB_ORIGIN`/DB pra VM.
4. **Fonte de verdade do gap** = `docs/GAP-ATUAL-2026-06-24.md` (o `COMPARATIVO-100.md` está
   defasado — não use como base).
5. **Saída final** = um único doc `docs/AUDITORIA-2026-06-25.md` com achados em **P0/P1/P2**.

## 🧰 Ambiente (gotchas pra não tropeçar)

- **Repo:** `C:\Users\Erick\Documents\GitHub\kiizinbr-ifp-familiaponcio` — rode `pnpm` **de dentro**.
- **Monorepo turbo + pnpm@9.12.3** (corepack). Node >= 20.11. Workspace: `apps/*` + `packages/*`.
- **Scripts:** `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build` · DB: `pnpm db:generate | db:migrate | db:seed | db:studio` (pacote `@ifp/database`, Prisma/Postgres).
- **Web sobe na porta `:3001`** (a `:3000` é do RAÍZ). `WEB_ORIGIN` precisa apontar pra `:3001`.
- **Dev server cai no shell de background** → suba com `Start-Process` (não com run_in_background simples).
- **Postgres roda em Docker no WSL2.** Garanta o container de pé antes de `db:migrate`.

---

## FASE 0 — Baseline técnico (compila? sobe?)
**Objetivo:** não auditar em cima de algo quebrado.

- Rodar, em ordem: `pnpm install` → `pnpm typecheck` → `pnpm lint` → `pnpm build` → `pnpm test`.
- Subir o app local: container Postgres no WSL2 → `pnpm db:generate` → `pnpm db:migrate` → `pnpm db:seed` → `pnpm dev` (via `Start-Process`) → abrir `http://localhost:3001`.
- **Agente:** `ecc:code-explorer` para mapear arquitetura/camadas (pule se já estiver claro), ou `/repo-scan`.

**Produz:** `STATUS-BASELINE` — typecheck/lint/build/test verde? App sobe? Liste o que falhou (vira P0 automático).

---

## FASE 1 — "FUNCIONA?" (validar o que já existe)
**Objetivo:** provar que os fluxos reais funcionam, não só unidades isoladas.

- **`/production-audit`** → retrato de prontidão pra produção (o que ainda trava o go-live).
- **`/e2e-testing`** + agente **`ecc:e2e-runner`** → fluxos críticos **por vertical**:
  - Médico: agenda → fila → ficha clínica → prontuário → **prescrição + bloqueio de alergia**.
  - Serviço Social: triagem → beneficiários.
  - Capacitação: curso → matrícula → **certificado em PDF**.
  - Educacional (Creche): diário do dia.
  - Esportivo: turma → frequência → graduação.
  - Portal da Família: jornada cruzada (2+ unidades).
  - Presidência: sala de comando / dados cross-unidade.
  - Auth: 1º acesso → troca de senha provisória → **consentimento de menor**.
- **`/click-path-audit`** no app (design CASA) → telas órfãs, botão morto, link que não leva a nada.
- **`/test-coverage`** → onde falta teste (priorize Médico e Auth, que são os críticos).
- **Segurança multi-tenant AO VIVO** (re-validar, já passou uma vez): `/browser-qa` para confirmar
  **tenant wall**, **IDOR de família** e **portão de perfil** — tentar acessar dados de outro tenant/família.

**Produz:** lista de fluxos **OK / quebrados / frágeis**, com evidência (screenshot/erro).

---

## FASE 2 — "O QUE MELHORAR?" (qualidade · segurança · performance)
**Objetivo:** achar o que está errado/arriscado no que já existe. **Rode os agentes em paralelo** (um por linha).

| Agente | Foco no IFP |
|---|---|
| `ecc:typescript-reviewer` | Tipos, async, padrões do monorepo TS. |
| `ecc:react-reviewer` | Telas CASA: hooks, render, fronteira server/client. |
| `ecc:database-reviewer` | Prisma/Postgres: schema, índices, N+1, **segurança de migration**. |
| `ecc:security-reviewer` + `/security-review` | LGPD, isolamento multi-tenant, segredos, OWASP. |
| ⭐ `ecc:healthcare-reviewer` | **Segurança clínica**: prescrição/alergia (CDSS), prontuário, integridade de dado médico, **PHI**. |
| `ecc:silent-failure-hunter` | Erros engolidos / catch vazio / fallback ruim (regra do Erick: nada de falha silenciosa). |
| `ecc:performance-optimizer` | Gargalos, queries lentas, bundle. |
| `ecc:a11y-architect` | Acessibilidade WCAG (instituto de uso público). |

> Skills de apoio do domínio clínico (consultar, não obrigatório rodar): `ecc:healthcare-phi-compliance`,
> `ecc:healthcare-cdss-patterns`, `ecc:healthcare-emr-patterns`.

**Depois de coletar:** deduplicar achados → **verificar adversarialmente** cada P0/P1 (confirmar no código
que é real antes de aceitar). Opcional pra itens sensíveis: `/santa-loop` (dois revisores têm que aprovar).

**Produz:** achados **verificados**, por severidade, com arquivo:linha e correção sugerida (sem aplicar).

---

## FASE 3 — "O QUE FALTA?" (gap / paridade vs. referência)
**Objetivo:** o que sistemas parecidos têm e o IFP não — sem reinventar o que já está mapeado.

- **`ecc:product-capability`** → mapa das capacidades **atuais** (cruzar com `docs/GAP-ATUAL-2026-06-24.md`).
- **`/deep-research`** → pesquisar **referências** por vertical:
  - Prontuário/EMR e gestão de clínica (ex.: iClinic, Feegow) → vertical Médico.
  - Gestão de ONG / terceiro setor / doações → Presidência + Site Público.
  - LMS / gestão de cursos e certificados → Capacitação.
  - Gestão escolar / creche → Educacional.
- **`ecc:product-lens`** → onde está o valor não atendido (ótica de usuário, não de feature).
- **Diff final:** `(capacidades atuais)` vs `(referências)` vs `(GAP-ATUAL grupos A–E)`.
  Marcar cada gap como **já mapeado** (qual grupo A–E) ou **novo**.

> Lembrete do estado atual (de `GAP-ATUAL`): núcleo interno **~88%**; **Site Público ~28% é o maior buraco**.
> Grupos de desbloqueio: **A** (dá pra fazer já) · **B** (camada de IA) · **C** (storage MinIO + envio) ·
> **D** (dados novos, baixa prioridade) · **E** (Site Público / design).

**Produz:** backlog de features **priorizado**, separando "já no GAP-ATUAL" de "novo (veio da referência)".

---

## FASE 4 — Consolidação (entregável)
Gerar **`docs/AUDITORIA-2026-06-25.md`** com 3 seções, cada item com `severidade (P0/P1/P2)` + `esforço (P/M/G)` + `evidência (arquivo:linha ou screenshot)`:

1. **Funciona?** — fluxos quebrados/frágeis (Fase 0 + 1).
2. **Qualidade & Segurança** — achados verificados (Fase 2).
3. **Gaps de feature** — backlog priorizado vs. referência (Fase 3).

No fim: lista do **que vira `/feature-dev`** e do **que precisa de decisão do Erick** (custo, infra, produto).
**NÃO implementar nada sem OK.**

---

## 🔁 Tornar recorrente (opcional, depois da 1ª rodada)
- **`/schedule`** semanal: `/production-audit` + `/security-review` rodando sozinhos e reportando achados.
- **`/hookify`**: hook pós-edição em arquivos críticos (Médico/Auth) → dispara revisão automática.

---

## ▶️ TL;DR (ordem pro outro terminal)
1. **Fase 0** — `pnpm install/typecheck/lint/build/test` + subir app `:3001`.
2. **Fase 1** — `/production-audit` → `/e2e-testing` (+`ecc:e2e-runner`) → `/click-path-audit` → `/test-coverage` → `/browser-qa` (multi-tenant).
3. **Fase 2** — paralelo: `typescript-reviewer` · `react-reviewer` · `database-reviewer` · `security-reviewer` · **`healthcare-reviewer`** · `silent-failure-hunter` · `performance-optimizer` · `a11y-architect` → verificar achados.
4. **Fase 3** — `product-capability` → `/deep-research` (referências) → `product-lens` → diff vs `GAP-ATUAL`.
5. **Fase 4** — escrever `docs/AUDITORIA-2026-06-25.md` (P0/P1/P2) e parar pra decisão do Erick.
