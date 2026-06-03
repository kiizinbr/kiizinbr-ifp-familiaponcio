# Migração visual global — IFP Connect → Design Kit "Ferramenta Clínica Premium"

**Data:** 2026-06-03
**Autor:** arquiteto (plano faseado a partir do dossiê de reconciliação + inventário de consumo + inventário de telas/chrome + paridade UI)
**Estratégia:** INCREMENTAL + PONTE (ligar o kit global sem quebrar nada; retrofit por área; remover o DS antigo só no fim)

---

## 0. Objetivo + estratégia + invariante de segurança

### Objetivo

Levar TODAS as telas do IFP Connect para o Design Kit canônico (`src/styles/ifp-tokens.css` + `ifp-components.css`, direção "Ferramenta Clínica Premium"), eliminando a coexistência de **3 sistemas visuais** (DS antigo `--ifp-*` triplet/Garet; tema "Editorial temperada" Fraunces/creme; kit clínico dormente) até sobrar **um só**: o kit, com tema (`data-theme`) e acento por unidade (`data-unit`/`data-unit-accent`) fiados em React.

### Estratégia: INCREMENTAL + PONTE

- **Ponte (FASE 0):** reconciliar os tokens para que o kit possa ser importado globalmente SEM disputar com o DS antigo nem mudar a cara das telas legadas. A paleta crua `--ifp-*` permanece TRIPLET (para `rgb(var(--ifp-*))` continuar válido), a camada semântica do kit passa a embrulhar em `rgb()`, e o `body`/grid/Hanken do kit fica ESCOPADO em `.ifp-kit` (não vaza). Resultado: kit disponível globalmente, telas antigas idênticas.
- **Incremental (FASES 1..N):** retrofit por área, ordenado pela **alavancagem de dependência** — primeiro os primitivos e o chrome compartilhado (uma migração beneficia ~14 telas), depois as áreas folha. Telas já-no-kit (`/capacitacao/*` + `/medico/consultas/[id]`) NÃO entram no retrofit; são as últimas a serem "dissolvidas".
- **Remoção (FASE FINAL):** só apagar o DS antigo (`.ifp-card`, paleta triplet redundante, escalas `--ifp-space/radius/shadow`, editorial, Garet) quando o grep provar **zero consumidores**.

### Invariante de segurança (NÃO NEGOCIÁVEL)

1. **Nenhuma tela antiga pode quebrar até ser retrofitada.** Concretamente: nunca apagar/renomear `--ifp-orange-900`, `--ifp-canvas` ou qualquer `--ifp-*` triplet do `globals.css` enquanto houver consumidor. O kit RENOMEOU esses dois tokens (`--ifp-orange-900`→`--ifp-brown-900`, `--ifp-canvas`→`--ifp-white`); a ponte mantém ALIASES triplet, nunca substitui.
2. **Cada passo é verificável** com (a) `pnpm build` verde (ritual: `pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build`) e (b) **screenshot before/after** de 1-2 telas representativas via Chrome DevTools no preview. Sem teste de regressão visual no repo → o screenshot manual É o gate.
3. **Uma fase = um PR/commit reversível.** Só avança quando o gate da fase anterior está verde. O `body`/grid/Hanken do kit NUNCA é aplicado globalmente; só onde o wrapper raiz tem `className="ifp-kit"` (telas novas/retrofitadas) ou via `[data-theme]` controlado.

---

## FASE 0 — RECONCILIAÇÃO + KIT GLOBAL (INVISÍVEL)

**Meta:** kit importado e disponível globalmente; telas antigas pixel-idênticas. Nenhuma mudança de aparência.

Edições em **3 arquivos**: `src/styles/ifp-tokens.css` (cópia do kit), `src/styles/ifp-components.css` (1 linha), `src/app/globals.css` (2 `@import`). `layout.tsx` recebe `data-theme="light"` (inerte porque o body do kit está escopado).

### 0.a — Paleta crua do kit → TRIPLET + aliases (ifp-tokens.css, bloco `:root` L21-35)

Trocar cada hex por triplet (só os 3 números, sem `rgb()`), preservando comentários. **Adicionar os dois aliases** que o app legado consome.

| Linha | DE (hex)                      | PARA (triplet)                                                                              |
| ----- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| L23   | `--ifp-orange-500: #ff772e;`  | `--ifp-orange-500: 255 119 46;`                                                             |
| L24   | `--ifp-orange-700: #c24d0f;`  | `--ifp-orange-700: 194 77 15;`                                                              |
| L25   | `--ifp-brown-900: #752c05;`   | `--ifp-brown-900: 117 44 5;` **+ nova linha:** `--ifp-orange-900: 117 44 5;` (alias legado) |
| L26   | `--ifp-teal-500: #10c2bb;`    | `--ifp-teal-500: 16 194 187;`                                                               |
| L27   | `--ifp-teal-700: #007571;`    | `--ifp-teal-700: 0 117 113;`                                                                |
| L28   | `--ifp-ink: #4a4a49;`         | `--ifp-ink: 74 74 73;`                                                                      |
| L29   | `--ifp-muted: #6b6b6b;`       | `--ifp-muted: 107 107 107;`                                                                 |
| L30   | `--ifp-white: #ffffff;`       | `--ifp-white: 255 255 255;` **+ nova linha:** `--ifp-canvas: 255 255 255;` (alias legado)   |
| L31   | `--ifp-surface-50: #fafaf9;`  | `--ifp-surface-50: 250 250 249;`                                                            |
| L32   | `--ifp-surface-100: #f4f4f2;` | `--ifp-surface-100: 244 244 242;`                                                           |
| L33   | `--ifp-surface-200: #e5e4e1;` | `--ifp-surface-200: 229 228 225;`                                                           |
| L34   | `--ifp-danger: #ba1a1a;`      | `--ifp-danger: 186 26 26;`                                                                  |
| L35   | `--ifp-warning: #b45309;`     | `--ifp-warning: 180 83 9;`                                                                  |

Os `*-rgb` (L38-43) ficam redundantes; deixar como estão (inofensivos).
**`--u-*` (L46-57) ficam HEX** — são camada de sotaque, não paleta crua; `color-mix(... var(--unit) ...)` no kit espera cor resolvida.

### 0.b — Camada semântica do kit → embrulhar `var(--ifp-*)` em `rgb()` (ifp-tokens.css)

Depois de 0.a a paleta é triplet; toda referência a `var(--ifp-*)` usada **como cor** precisa virar `rgb(var(--ifp-*))`:

- **Default do sotaque (L58-59):**
  - L58 `--unit: var(--ifp-teal-700);` → `--unit: rgb(var(--ifp-teal-700));`
  - L59 `--unit-2: var(--ifp-teal-500);` → `--unit-2: rgb(var(--ifp-teal-500));`
- **Tema claro (`:root, html[data-theme="light"]`):**
  - L104 `--accent: var(--ifp-teal-700);` → `--accent: rgb(var(--ifp-teal-700));`
  - L107 `--live: var(--ifp-orange-500);` → `--live: rgb(var(--ifp-orange-500));`
  - L113 `--ok: var(--ifp-teal-700);` → `--ok: rgb(var(--ifp-teal-700));`
- **Tema escuro (`html[data-theme="dark"]`):**
  - L134 `--accent: var(--ifp-teal-500);` → `--accent: rgb(var(--ifp-teal-500));`
  - L143 `--ok: var(--ifp-teal-500);` → `--ok: rgb(var(--ifp-teal-500));`

NÃO tocar: `--accent-soft/-line` (L105/106/135/136), `--live`/`--live-soft` do dark (L137/138), `--warn`/`--danger`/seus `-soft` (L109-112/139-142), `--ok-soft` (L114/144) — já são `rgba()`/hex literais, não usam `--ifp-*`.

### 0.c — `var(--ifp-brown-900)` direto em ifp-components.css (única ocorrência)

- **L386** `color-mix(in srgb, var(--accent) 55%, var(--ifp-brown-900))` → `color-mix(in srgb, var(--accent) 55%, rgb(var(--ifp-brown-900)))`.
  (Confirmado por leitura: é a ÚNICA ref a `--ifp-*` em ifp-components.css; o resto usa `--accent/--unit/--surface/--line` já resolvidos.)

### 0.d — Escopar o `body`/reset do kit em `.ifp-kit` (ifp-tokens.css L200-211)

O bloco `body { … grid bg + Hanken + cor + line-height + letter-spacing }` (L200-211) NÃO pode ser global — vazaria grid+Hanken pra todas as telas antigas. Trocar o seletor `body` por `.ifp-kit` e fazer o background-color/image herdarem só nesse escopo:

```css
/* DE (L200-211) */
body {
  margin: 0;
  font-family: var(--font-ui);
  background-color: var(--bg);
  background-image: linear-gradient(...);
  background-size: 32px 32px;
  color: var(--text);
  line-height: 1.45;
  letter-spacing: -0.01em;
}

/* PARA */
.ifp-kit {
  font-family: var(--font-ui);
  background-color: var(--bg);
  background-image: linear-gradient(...);
  background-size: 32px 32px;
  color: var(--text);
  line-height: 1.45;
  letter-spacing: -0.01em;
}
```

- `html { -webkit-font-smoothing; text-rendering }` (L196-199) pode ficar global (inofensivo).
- `* { box-sizing: border-box }` (L193-195) é redundante com o Tailwind preflight; manter (inofensivo).
- O `@import` do Google Fonts (L19) fica global — só BAIXA Hanken, não pinta nada (Hanken só pinta dentro de `.ifp-kit`).

### 0.e — Importar o kit no globals.css (logo após a L1)

Em CSS, `@import` precisa vir no topo. A L1 é `@import "tailwindcss";`. Inserir os dois imports do kit **imediatamente após a L1**, antes de qualquer `@font-face`/`:root`:

```css
@import "tailwindcss";
@import "../styles/ifp-tokens.css";
@import "../styles/ifp-components.css";
```

Ordem da cascata resultante: kit primeiro, `globals.css` (`:root` L47-123) depois → o `:root` do globals re-declara a paleta triplet (valores idênticos, sem conflito visual) e adiciona escalas `--ifp-space/radius/shadow` + tokens editoriais que o kit não tem. O `body { font-family: Garet }` do globals (L140-152) continua vencendo (o kit não tem mais regra de `body`). Camada semântica do kit (`--bg/--surface/--accent/--unit`) sobrevive intacta (o globals não a define).

### 0.f — `layout.tsx`: `data-theme="light"` no `<html>` (inerte na Fase 0)

- L11 `<html lang="pt-BR">` → `<html lang="pt-BR" data-theme="light">`.
  Inerte porque nenhuma tela tem `.ifp-kit` ainda; serve só de fundação para o motor de tema das fases seguintes.

### Critério de PRONTO da Fase 0

- `pnpm build` verde (ritual completo).
- **Screenshot before/after** de 1-2 telas DS-antigo (sugestão: `/medico/agenda` e a landing `/`) — devem ser IDÊNTICAS (fundo branco, Garet, cores intactas).
- Conferir no DevTools que `rgb(var(--ifp-orange-900))` e `rgb(var(--ifp-canvas))` ainda resolvem (não viram transparente/preto).
- Conferir que `/capacitacao` e `/medico/consultas/[id]` (já-no-kit, via .module.css escopado) seguem idênticas — não dependem do globals.

---

## FASES 1..N — RETROFIT POR ÁREA (ordenado por dependência/alavancagem)

Regra geral por fase: trocar `rgb(var(--ifp-*))` cru + `.ifp-card` + classes Tailwind arbitrárias por **componentes React 1:1 do kit** (`<Card>` → `.card`, `<Button variant>` → `.btn btn-*`, etc.) consumindo a camada semântica (`--surface/--line/--text/--accent/--unit`), e marcar o wrapper de segmento com `className="ifp-kit"` + `data-unit`/`data-unit-accent`. Tokens não-cor (`--ifp-space/radius`) migram para `--sp-*/--r-*` (escalas disjuntas, não colidem; nunca misturar as duas numa mesma tela). **Telas já-no-kit NÃO entram** (vide Fase Final).

Dimensão total do retrofit: **442 refs `var(--ifp-*)` em 43 arquivos** (389 cor + ~53 não-cor). `/medico` + `/app` concentram ~289 (65%).

### FASE 1 — PRIMITIVOS `@/components/ui` (alavancagem MÁXIMA) — pequena

**Telas:** nenhuma direta; são primitivos herdados.
**Arquivos (38 refs):** `card.tsx` (7), `badge.tsx` (11), `button.tsx` (9), `input.tsx` (7), `empty-state.tsx` (4).
**O que muda:** reescrever cada primitivo para aplicar a classe global do kit em vez de Tailwind+triplet:

- `<Card>` → `.card` (+ `> header`/`.tick`/`.body`; acento por `data-unit`+`.unit-strip`, não `border-top` por slug).
- `<Badge>` → `.badge` (+ `.dot`/`.pulse`; ganha variantes `live`/`unit`). **Decisão de design:** `info` do React era laranja-900; no kit `-info` = teal/`--accent`. Mudança consciente.
- `<Button>` → `.btn btn-*`. **Decisão de design:** `primary` deixa de ser laranja chapado e vira gradiente do `--accent` (teal/sistema, ou cor da unidade sob `data-unit-accent`). Ganha `.btn-unit`, `.is-loading`, `.btn-block`.
- `<Input>` → `.input`+`.label`+`.field-error` (foco com ring `--accent-soft`, `.is-error`, `.field-hint`). Criar irmãos `<Select>`/`<Textarea>` (kit já tem `.select`/`.textarea`).
- `<EmptyState>` → `.empty` (quase drop-in: leão 96px @30% + título + msg + CTA).
  **Gate:** build verde + screenshot das 7 telas `/medico` que importam esses primitivos (são as únicas consumidoras: agenda, minha-agenda, especialidades, profissionais[/novo/[id]], consultas/nova). Aprovar a mudança consciente de cor do Button/Badge com Erick.
  **Nota:** migrar primitivo NÃO propaga sozinho — telas que usam `<button>`/`<input>` cru com `[rgb(var(--ifp-*))]` precisam trocar JSX cru por componente, tela a tela (nas fases 3/4).

### FASE 2 — CHROME / AppShell compartilhado (destrava ~14 telas) — média/grande

**Telas:** indireta — todo `/medico` DS, todo `/app`, `/social` vivem dentro do AppShell.
**Arquivos (~50 refs):** `app-shell.tsx` (7), `medico/medico-shell.tsx` (4), `capacitacao/capacitacao-shell.tsx` (1), `sidebar-nav.tsx` (3), `unit-switcher.tsx` (3), `kpi-card.tsx` (9), `unidade-login-shell.tsx` (23, vai na Fase 5).
**O que muda:** reescrever `app-shell.tsx` para o layout do kit (`ifp-components.css` L858-1051): `.shell` (grid 256px+1fr), `.sidebar` (`.sb-brand`/`.sb-group`/`.symbol`), `.nav-item`(+`.on`/`.count`), `.topbar` (NOVO — título+busca+toggle de tema, que o AppShell atual não tem), `.content` (max 1280), `.page-head`. Trocar o `sectionColor`-prop (hoje string `"rgb(var(--ifp-teal-700))"`) pelo **contrato `data-unit`/`data-unit-accent`** setado por server component no wrapper de cada segmento. `MedicoShell`/`CapacitacaoShell` passam a só setar `data-unit="medico|capacitacao"` (+`data-unit-accent`) e o label.
**Componente novo obrigatório:** toggle de tema como **client component** (substituto do `scaffold-chrome.js`, que é descartável e não faz parte do kit) — persiste em `localStorage`, seta `data-theme` no `<html>`. `<KpiCard>` vira componente React mapeando `.kpi`/`.kpi-val`/`.kpi-delta`.
**Gate:** build verde + screenshots de uma tela de cada segmento sob o shell novo (`/medico/agenda`, `/app/vagas`, `/social`) — chrome coeso, acento correto por unidade, toggle claro/escuro funcionando.

### FASE 3 — Área `/medico` (miolo das telas) — grande (~168 refs)

**Telas (DS, sem o prontuário que já está no kit):** `minha-agenda` (35), `consultas/nova` (33), `profissionais/[id]` (28), `profissionais/novo` (22), `agenda` (19), `especialidades` (19), `profissionais` (11), `page.tsx` home (editorial — vai na Fase 5).
**O que muda:** miolo de cada tela passa a usar os componentes da Fase 1 + classes do kit (`.table-wrap`/`.tbl` para listas densas, `.page-head` herdado do shell, `.field-group` para forms). Reaproveitar scaffolds `lista-tabela.html` e `wizard.html` (consultas/nova) do kit. CSS Module só para grid/layout idiossincrático, consumindo tokens globais (sem redefinir).
**Gate:** build verde + screenshot de cada uma das 7 telas; conferir densidade/acento teal consistentes com o prontuário (que já é kit).

### FASE 4 — Área `/app` (CRM cidadãos/vagas) + `/social` — grande (~121 refs)

**Telas:** `cidadaos/[id]/triagem/triagem-form` (20), `cidadaos/[id]` (19), `cidadaos/novo/form` (17), `app/[unit]` (11, usa KpiCard), `vagas/[id]/agendamentos` (10), `cidadaos/[id]/historico` (8), `cidadaos/[id]/anexo-uploader` (7), `vagas` (7), `vagas/[id]` (5), `cidadaos/[id]/triagem/page` (4), `cidadaos/[id]/editar` (3), `cidadaos/novo/page` (3), `vaga-form` (3), `vagas/nova` (2), `app/[unit]` resto, `social/page` (10). (`cidadaos/page` e `app/page` são editorial → Fase 5.)
**O que muda:** listas → `.table-wrap`/`.tbl`; forms → `field-group`/`<Input>`/`<Select>`/`<Textarea>` + `wizard.html` (triagem é multi-step → `.stepper`, componente novo); cards de cidadão → `<Card>`; KPIs → `<KpiCard>`. Wrapper de segmento com `data-unit` da unidade ativa.
**Gate:** build verde + screenshots de um form (triagem), uma lista (vagas) e `/social`.

### FASE 5 — EDITORIAL (4 telas) + STANDALONE/auth — média

**5.a Editorial (remover o 3º sistema):** as 4 telas que importam `@/components/editorial` — `medico/page` (home/Fila), `app/page` (visão geral), `app/cidadaos/page`, `admin/users/page` — são reskinnadas no kit (home médica → scaffold `app-shell.html` "Fila do dia"; `/app` → `dashboard-kpi.html`). **Reimplementar a LÓGICA** que vive em `editorial.tsx` no vocabulário do kit antes de deletar: `TimelineRow`/`Agenda` (barra de progresso "em curso", stagger) → `.timeline`/`.tl-item.live`; `KpiLedger` → `.kpi`. Só então DELETAR `src/components/editorial/*` inteiro (137 refs no `editorial.module.css` somem de uma vez).
**5.b Standalone/auth:** `/` (landing), `/poncio` (12 refs), `/[unidade]` (10) + `unidade-login-shell.tsx` (23) [fluxo login por unidade ~33], `(auth)/login/login-form` (8), `/[unidade]/login`, `/reset` (fora dos tokens hoje), `not-found.tsx` (7). Alinhar ao scaffold `login-tematico.html` (já existe).
**Gate:** build verde; grep `@/components/editorial` retorna ZERO; screenshots das 4 telas reskinnadas + login por unidade.

---

## FASE FINAL — REMOÇÃO DO DS ANTIGO + TOKENS ÓRFÃOS

Só executar quando o grep provar **zero consumidores** de cada item.

1. **Dissolver os .module.css duplicados** (`capacitacao.module.css` 499L, `prontuario.module.css` 562L): remover os blocos `:root`-locais que redefinem `--surface/--accent/--r-*/--shadow/--font-mono` e deixar o `.root` HERDAR os tokens globais do kit; trocar hardcodes (`--accent #007571`, `--info #2563eb`, `--success #15803d` fantasmas) por `data-unit`+`--accent`/`--ok`. Telas já-no-kit ficam intocadas até AQUI.
2. **Remover do globals.css** (verificar grep zero antes de cada): `.ifp-card`/`.ifp-card-hover` (L126-138); paleta triplet `--ifp-*` redundante — MAS só os nomes que o kit já provê via alias; escalas `--ifp-space-*`/`--ifp-radius-*`/`--ifp-shadow-*`/`--ifp-transition-*` (L84-110) quando nenhuma tela as usar; bloco editorial `--font-display`/`--font-body`/`--ifp-paper*`/`--ifp-ink-warm/-soft`/`--ifp-hair*` (L112-122) + `@font-face` Fraunces/Spline (L25-45); `body { font-family: Garet }` (L140-152) + `@font-face` Garet (L6-20).
3. **Garet sai de vez** (decisão Erick) — quando ninguém herdar mais Garet (todas as telas sob `.ifp-kit`/Hanken). `medico/page.tsx` tem 1 ref direta a Garet a remover.
4. **Limpar `tailwind.config.ts` L9-13:** `--ifp-medico/capacitacao/esportivo/educacional/social` são cores Tailwind MORTAS (zero defs, zero usos de `bg-ifp-*`). Remover (bug latente, não bloqueia nada).
5. **Self-hostar Hanken** como woff2 + trocar o `@import` Google Fonts (ifp-tokens L19) por `@font-face` local (alinha com o padrão self-host Garet/Fraunces/Spline; remove render-blocking).

**Gate final:** build verde; grep `--ifp-orange-900|--ifp-canvas|\.ifp-card|@/components/editorial|Garet|Fraunces` → zero (exceto onde intencional); screenshot de uma tela de cada área + toggle de tema global.

---

## DECISÕES PRO ERICK

1. **Button `primary`: laranja chapado → gradiente teal/acento?** O kit faz `primary` = gradiente do `--accent` (teal de sistema, ou cor da unidade sob `data-unit-accent`), NÃO o laranja fixo atual. Muda a cara dos botões de todo `/medico`. **Recomendo SIM** (é a regra de ouro do kit). Confirmar.
2. **Badge `info`: laranja-900 → teal?** Diverge semanticamente (React `info`=laranja; kit `-info`=teal/accent). Recomendo adotar o kit.
3. **CSS Modules por tela vs classes globais?** **Recomendo híbrido:** componente vem de React 1:1 mapeando classe global do kit (1 fonte de verdade); CSS Module fica só como "cola de layout" fina (grids/posicionamento idiossincrático), consumindo tokens globais sem redefini-los. Evita o drift atual (os 2 módulos re-tokenizam e re-copiam componentes).
4. **Remover o tema Editorial (Fraunces/creme)?** Foi aprovado 2026-05-31, antes da decisão pelo kit clínico. **Recomendo remover** na Fase 5 (são 4 telas + 1 sistema inteiro de 137 refs). Confirmar que a home médica "Fila do dia" pode migrar para o look clínico.
5. **Garet sai de vez?** Sim na Fase Final — substituída por Hanken Grotesk (kit). Confirmar.
6. **Tema escuro entra no escopo?** O kit é theme-aware (`data-theme`). Decidir se o toggle claro/escuro é entregue já na Fase 2 (chrome) ou fica desligado até depois.

---

## RISCOS + MITIGAÇÕES

| #           | Risco                                                                                                                                                                                                   | Mitigação                                                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| R1 (ALTO)   | Kit renomeia `--ifp-orange-900`→`--ifp-brown-900` e `--ifp-canvas`→`--ifp-white`; ~10 arquivos legados usam os nomes antigos. Apagar/renomear → `rgb(var(--undef))` → texto/fundo pretos/transparentes. | **Manter aliases triplet** `--ifp-orange-900`/`--ifp-canvas` na cópia do kit (0.a) e nunca apagar do globals até grep zero.             |
| R2 (ALTO)   | `@import` do kit fora do topo em Tailwind 4 → ignorado silenciosamente.                                                                                                                                 | Inserir os 2 `@import` **imediatamente após a L1** `@import "tailwindcss";` (0.e). Validar no DevTools que `.card`/`--accent` resolvem. |
| R3 (ALTO)   | `body` do kit (grid+Hanken) importado sem escopo → muda a cara de TODAS as telas antigas (Fase 0 deixaria de ser invisível).                                                                            | Escopar o `body` do kit em `.ifp-kit` (0.d); telas antigas não recebem a classe → mantêm Garet+branco.                                  |
| R4 (MÉDIO)  | Mudança de cor Button/Badge "silenciosa".                                                                                                                                                               | Tratar como decisão de design explícita (Decisões 1-2); screenshot before/after na Fase 1.                                              |
| R5 (MÉDIO)  | Os 2 .module.css duplicaram tokens — se valores do kit mudarem, dessincronizam silenciosamente.                                                                                                         | Dissolvê-los na Fase Final (herdar tokens globais); até lá, não alterar valores de paleta.                                              |
| R6 (MÉDIO)  | Remover `editorial/*` quebra 4 telas se a lógica (TimelineRow/Agenda/KpiLedger: progresso, stagger, tons) não for reimplementada antes.                                                                 | Reimplementar no vocabulário do kit (`.timeline`/`.tl-item.live`/`.kpi`) ANTES de deletar (Fase 5.a).                                   |
| R7 (MÉDIO)  | Kit não empacota JS de chrome (toggle de tema, dropdown).                                                                                                                                               | Escrever client component próprio na Fase 2; `data-unit`/`data-unit-accent` via server component no wrapper de segmento.                |
| R8 (BAIXO)  | Sem teste de regressão visual no repo (ritual só cobre unit/build/lint/types).                                                                                                                          | Screenshot manual via Chrome DevTools É o gate de cada fase (invariante 2).                                                             |
| R9 (BAIXO)  | Drift de valores entre escalas (`--ifp-radius-sm` 6px vs `--r-sm` 7px; `--ifp-radius-lg` 16px vs `--r-lg` 14px). Não é colisão (nomes disjuntos).                                                       | Regra: tela retrofitada usa SÓ `--sp/--r/--t` do kit; tela legada SÓ `--ifp-space/radius/transition`. Nunca misturar numa tela.         |
| R10 (BAIXO) | `tailwind.config.ts` L9-13 referencia cores `--ifp-*` inexistentes (mortas).                                                                                                                            | Remover na Fase Final; não bloqueia Fase 0.                                                                                             |
| R11 (BAIXO) | `@import` remoto Google Fonts (Hanken) é render-blocking, foge do self-host.                                                                                                                            | Aceitável até a Fase Final; self-hostar Hanken woff2 lá.                                                                                |
