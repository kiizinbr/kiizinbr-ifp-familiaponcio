# Plano — "Editorial temperada" → propagação pras 8 telas /medico

**Data:** 2026-05-31 · **Status:** APROVADO (Erick escolheu "Editorial temperada (aposta)" no comparador) · pronto pra executar
**Decision-aid:** `public/lab/comparador.html` (origin/main `5479b3f`) → http://localhost:3000/lab/comparador.html
**Direções-fonte:** `public/lab/fila-editorial.html` (base), `fila-sereno.html` (teal-cuidado), `fila-comando.html` (só o nó AGORA)
**Análise de custo:** workflow `analise-direcoes-fila` (6 agentes) — ver memória [[project-ifp-connect]]

## A direção escolhida

**Editorial temperada** = base **Editorial** (serifa display Fraunces, números-manchete, hairlines, tinta-sobre-papel, tema CLARO — maior nota 50) **+** o **teal-cuidado do Sereno** (suaviza o tom institucional pro domínio de saúde de família; a unidade médico já é teal) **+** o **nó "AGORA · em curso ~14 min" do Comando** (melhor tratamento de "quem está sendo atendido"), **sem** o dark mode.

Princípio: tema claro, paleta brandbook, Fraunces como voz display, Garet pode conviver (corpo) ou sair — decidir na T0.

## Por que faseado: fundação compartilhada primeiro

A análise mostrou que ~40% do custo é uma **fundação** comum. Construí-la de forma **ADITIVA** (sem alterar Card/Badge existentes, que são universais e usados por outras unidades) destrava a Fila e as outras 7 telas sem risco de quebrar nada.

### FASE 0 — Fundação (aditiva, não quebra telas existentes)

- **T0.1 — Fontes self-hosted.** Adicionar **Fraunces** (variável, eixos opsz+wght, subset latin) e **Spline Sans** via `next/font/local` (padrão do projeto — NÃO usar CDN do Google: LGPD/perf/offline). Baixar `.woff2`, colocar em `/public/fonts/`. Expor como CSS vars `--font-display` (Fraunces) e `--font-body` (Spline). **Decisão T0:** Garet sai do /medico ou convive? (recomendo conviver: Garet no corpo das telas não-Fila, Fraunces no display — minimiza divergência com o resto do IFP). Verify: build sem CLS, `pnpm build` verde.
- **T0.2 — Tokens novos no `globals.css`** (ADICIONAR, não remover os `--ifp-*` atuais): `--ifp-paper` (#FBF8F3), `--ifp-paper-2` (#F4EFE6), `--ifp-ink-warm` (#1E1813), `--ifp-ink-soft` (#5A5048), `--ifp-hair` (rgba tinta .14), `--ifp-hair-strong` (rgba tinta .30). Esses são o "ramp editorial" — escopá-los a um wrapper `.medico-editorial` pra NÃO vazar pro resto do app.
- **T0.3 — Badge: NOVA variant `now`/`live`** (adicionar ao `VARIANTS` de `src/components/ui/badge.tsx`, sem mexer nas 5 existentes): pílula sólida teal com dot pulsante (ping). Cobre o estado `em_atendimento`. Alternativa se quiser isolar: componente `BadgeNow` em `src/components/medico/editorial/`.
- **T0.4 — Componentes novos** em `src/components/medico/editorial/` (não tocam o DS global): `Masthead` (kicker + h1 serifado Fraunces + dateline + relógio — substitui o uso do MedicoHeader na Fila), `KpiLedger` (3 colunas, filete superior colorido, número-herói Fraunces — substitui MiniKpi), `TimelineRow` (linha da fila: hora + nó cor-especialidade + nome + badge; estados `now`/`done`/`future`; o `now` ganha a faixa teal + barra "em curso ~Xmin"), `SpecChip` (chip tonal por especialidade via `color-mix`).
- **T0.5 — a11y de movimento:** TODA animação (ping do AGORA, stagger de entrada, relógio) atrás de `@media (prefers-reduced-motion: reduce)` restaurando `opacity:1`/estado final (lição do bug do Sereno). Stagger via delay calculado por índice (não inline). Relógio ao vivo = `aria-hidden`.

**Verify T0:** `pnpm format && pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build` — tudo verde, e as 8 telas atuais **inalteradas** (fundação é aditiva).

### FASE 1 — Converter a Fila (prova)

- **T1 — `src/app/medico/page.tsx`.** Trocar a apresentação (mantendo TODA a lógica server: `consultasHoje`, KPIs, `idxAgora`, `corDestaque`) por Masthead + KpiLedger + lista de TimelineRow. O nó AGORA usa a faixa teal + barra "em curso". Conferir contraste WCAG (ink-soft sobre paper ~7:1 ok; re-auditar chips/slot-livre). Preview pra revisão do Erick de manhã.
- **Verify T1:** suíte verde + screenshot via chrome-devtools (comparar com `fila-editorial.html`) + e2e `medico-agenda.spec` ainda passando.

### FASE 2 — Propagar pras outras 7 telas

Aplicar a linguagem (Fraunces display, hairlines, ledger, paper ramp, teal-cuidado) tela a tela. As densas exigem JULGAMENTO (não há mockup): definir o que "editorial" significa em cada uma.

1. `agenda/` (grid Doctolib semanal) — hairlines nas células, Fraunces nos cabeçalhos de dia/hora; cuidar densidade.
2. `minha-agenda/` (self-service do profissional).
3. `profissionais/` (lista) + `profissionais/novo` + `profissionais/[id]` (form).
4. `especialidades/` (CRUD).
5. `consultas/nova` (wizard 4 passos) — Masthead + passos com numeração editorial.
6. `consultas/[id]` (detalhe + transições).

**Verify FASE 2:** após cada tela, suíte verde; ao fim, `pnpm build` + e2e + revisão visual.

## Riscos / decisões abertas

- **T0:** Garet sai ou convive no /medico? (recomendo conviver).
- **Badge:** estender a variant universal vs. componente `BadgeNow` isolado (recomendo isolar em /medico/editorial pra não arriscar outras unidades).
- **Backend:** o mockup mostra "em curso ~14 min" — exige `dataHoraInicio` do slot + relógio (já temos) → derivável no client, SEM mudança de schema. "Sala/telefone" do Cívico NÃO entram (não escolhido).
- **Divergência de marca:** /medico fica Fraunces; resto do IFP é Garet. Aceito como sub-tema da unidade (decisão implícita na escolha).

## Como executar

- Núcleo testável (helpers de cálculo de "em curso", estados de TimelineRow) → TDD, dá pra ralph-loop. UI → `frontend-design` direto, preview→revisão.
- Sempre rodar pnpm DENTRO do WSL; push pelo git nativo do Windows. Ver [[reference-ifp-dev-commands]], [[feedback-wslrelay-postgres]].
