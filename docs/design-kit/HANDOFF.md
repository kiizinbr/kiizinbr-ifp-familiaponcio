# Handoff — IFP Connect · Design Kit

> **Para o Claude do terminal / dev:** este pacote é a fundação visual completa do **IFP Connect**, na direção **"Ferramenta Clínica Premium"**. Leia este documento de cima a baixo: ele explica **como o design foi montado** e **como portá-lo para o codebase Next.js** do repositório `kiizinbr-ifp-familiaponcio`.

---

## 1. Visão geral

O IFP Connect é a plataforma do Instituto Família Pôncio, com várias unidades (Centro Médico, Capacitação, Esportivo, Recreativo, Serviço Social, Pôncio Executivo). O desafio de design: **uma marca só**, mas com **diferenciação clara entre unidades** — resolvido tratando a cor da unidade como **acento da interface**, sobre uma fundação única (tipografia, layout, espaçamento e fundo idênticos).

Este kit entrega: **tokens** (claro/escuro + paleta canônica do brandbook), **biblioteca de componentes** em CSS puro, e **scaffolds** (esqueletos de página prontos para forkar).

## 2. Sobre os arquivos deste pacote

Os arquivos `.html` são **referências de design feitas em HTML/CSS** — protótipos que mostram aparência e comportamento pretendidos, **não** código para colar direto. A tarefa é **recriar esses designs no ambiente do codebase** (Next.js App Router + Tailwind), usando os padrões já existentes.

**Exceção importante:** `ifp-tokens.css` e `ifp-components.css` **são código aproveitável de verdade** — foram escritos como fonte da verdade e podem ir direto para `src/styles/`. Os nomes `--ifp-*` e os triplets RGB já foram alinhados com o `globals.css` atual do repo.

## 3. Fidelidade

**Alta fidelidade (hi-fi).** Cores, tipografia, espaçamento e interações são finais. Recriar pixel-perfect usando as libs/padrões do codebase.

---

## 4. A arquitetura do sistema (como foi montado)

Quatro camadas, todas em `ifp-tokens.css`:

1. **Paleta canônica do brandbook** (`--ifp-*`) — restrição dura de marca. Nunca mudar os valores, só o uso.
2. **Sotaque por unidade** (`--u-*`) → resolve em `--unit` / `--unit-2` conforme `[data-unit]`.
3. **Camada semântica de tema** (`--bg`, `--surface`, `--text`, `--accent`, `--line`…) — troca sozinha entre `[data-theme="light"]` e `[data-theme="dark"]`.
4. **Escalas** — espaço (base 4px), raio, sombra, tipografia, motion.

### Os três contratos de atributo (o coração do sistema)

| Atributo | Onde | Efeito |
|---|---|---|
| `data-theme="light\|dark"` | `<html>` | Alterna toda a camada semântica. Fundo universal um pouco escurecido no claro (`--bg: #e7eaea`), cards brancos por cima. |
| `data-unit="medico\|capacitacao\|esportivo\|recreativo\|poncio\|social"` | `<body>` | Define `--unit`/`--unit-2`. Usado em faixas, selos, sidebar strip. |
| `data-unit-accent` | `<body>` (junto de `data-unit`) | **Remapeia `--accent` → `--unit`.** Botões primários, item de menu ativo, ícones de KPI, foco e links passam a usar a cor da unidade. É o que torna a diferenciação **evidente** mantendo uma marca só. |

> **Regra de ouro:** uma marca só. O que muda entre unidades é o **acento** (a "cor do crachá") — nunca a tipografia, o layout, a densidade ou o fundo.

> **Onde os contratos já são emitidos no app (2026-06-14):** `data-theme="light|dark"` sai do layout raiz (`src/app/layout.tsx`). `data-unit` + `data-unit-accent` **não** vêm de um `layout.tsx` de segmento — vêm do **shell de componente**: `AppShell` (`src/components/app-shell.tsx`) recebe a prop `unit` e emite ambos no `.shell.ifp-kit`; o subtree inteiro herda. O Centro Médico usa `MedicoShell` (`src/components/medico/medico-shell.tsx`), que chama `<AppShell unit="medico">` — por isso todas as telas `/medico/*` já carregam o acento teal (`--accent` → `--unit` = `#007571`) sem nenhum CSS de acento por tela. **Não recriar** o acento via `src/app/medico/layout.tsx` nem via `<TemaUnidade>` no segmento: seria um segundo mecanismo concorrente para o mesmo contrato. Para uma unidade nova, basta um shell análogo passando `unit="<slug>"`.

### 4º contrato — tema CASA por subtree (camada aditiva, 2026-06-12)

| Atributo | Onde | Efeito |
|---|---|---|
| `data-theme="medico\|capacitacao\|esportivo\|recreativo\|poncio\|social"` | **container** (`<div>` de layout/card) | Tematiza o subtree inteiro com o trio CASA `--unidade`/`--unidade-escuro`/`--unidade-suave` **e** equivale a `data-unit` + `data-unit-accent` dentro dele (a ponte re-resolve `--unit`/`--unit-2`/`--accent`). 100% CSS, sem JS. |

- Fonte: `src/styles/casa-tokens.css` (porte da direção editorial "CASA", reconciliação estratégia A — main canônica, camada só estende).
- Não colide com o `data-theme="light|dark"` do `<html>`: os seletores claro/escuro são escopados em `html[data-theme=…]`.
- Helper React: `<TemaUnidade tema="medico">` (`src/components/tema-unidade.tsx`) + `temaCasaDoSlug()` (`src/lib/tema-casa.ts`).
- Ponte Tailwind (`@theme inline` no `globals.css`): `bg-primary`, `hover:bg-primary-hover`, `bg-unidade-suave`, `bg-papel`, `text-tinta`, `shadow-casa(-sm)`, `font-display` (Jost p/ display/headings) etc. — tudo resolve em runtime contra o tema do subtree.

---

## 5. Design tokens (valores exatos)

### Paleta canônica do brandbook
| Token | Hex | Uso |
|---|---|---|
| `--ifp-orange-500` | `#FF772E` | Ação primária, CTAs |
| `--ifp-orange-700` | `#C24D0F` | Forte / hover |
| `--ifp-brown-900` | `#752C05` | Headlines, mascote (leão) |
| `--ifp-teal-500` | `#10C2BB` | Info / success claro |
| `--ifp-teal-700` | `#007571` | Saúde / médico / success forte |
| `--ifp-ink` | `#4A4A49` | Texto corpo |
| `--ifp-muted` | `#6B6B6B` | Texto secundário |
| `--ifp-danger` | `#BA1A1A` | Erro |
| `--ifp-warning` | `#B45309` | Alerta |

### Sotaque por unidade (`--u-*` → `--unit`)
| Unidade | Cor 1 | Cor 2 |
|---|---|---|
| Médico | `#007571` | `#10C2BB` |
| Capacitação | `#FF772E` | `#C24D0F` |
| Esportivo | `#C24D0F` | `#752C05` |
| Recreativo | `#10C2BB` | `#007571` |
| Pôncio | `#752C05` | `#4A4A49` |
| Social | `#4A4A49` | `#6B6B6B` |

### Semânticos — tema claro / escuro (resumo)
`--bg` `#e7eaea` / `#0e1011` · `--surface` `#ffffff` / `#16191a` · `--surface-sunken` `#edf0f0` / `#101314` · `--line` `#dfe3e3` / `#262b2c` · `--text` `#1b1d1d` / `#ecefef` · `--text-2` `#4a4a49` / `#aab2b2` · `--text-3` `#82888a` / `#6f7878`. Acento de sistema (sem `data-unit-accent`): teal-700 (claro) / teal-500 (escuro). Estados: `--live` (laranja, "agora"), `--ok`, `--warn`, `--danger` com variantes `-soft`.

### Escalas
- **Espaço** (base 4px): 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64
- **Raio**: `--r-sm` 7 · `--r-md` 10 · `--r-lg` 14 · `--r-xl` 20 · `--r-full` 999
- **Sombra**: `--shadow` (elevação base de card) · `--shadow-pop` (flutuante)
- **Motion**: `--t-fast` 120ms · `--t-base` 200ms · `--t-slow` 320ms, todos `ease-out`

### Tipografia
- **UI:** Hanken Grotesk (400/500/600/700/800) — `--font-ui`
- **Dados/números/labels:** IBM Plex Mono (400/500/600), com numerais tabulares — `--font-mono`
- Carregadas via Google Fonts no topo de `ifp-tokens.css`.
- Escala: `.t-display` 38/800 · `.t-h1` 28/800 · `.t-h2` 21/800 · `.t-h3` 16/700 · `.t-body` 14.5/400 · `.micro` 10.5 mono caixa-alta tracking 0.13em.

---

## 6. Biblioteca de componentes (`ifp-components.css`)

Classes utilitárias, todas com estados (hover/focus/disabled/loading quando cabe):
`.btn` (`-primary`/`-unit`/`-secondary`/`-ghost`/`-danger`, `-sm`/`-lg`, `.is-loading`) · `.card` (header com `.tick`) · `.input`/`.select`/`.textarea` (+ `.is-error`, `.input-search`) · `.badge` (`-success`/`-info`/`-warning`/`-danger`/`-live`/`-unit`) · `.chip` · `.avatar` · `.kpi` (+ `.drill`) · `table.tbl` (densa) · `.timeline` · `.stepper` · `.toast` · `.modal` · `.empty` · `.skel` (skeleton) · `.segmented` · `.toggle-pill`.

**App shell:** `.shell` (grid 256px + 1fr) · `.sidebar` (com `.nav-item`, `.sb-group`, tira de unidade no topo) · `.topbar` · `.content` · `.page-head` · `.unit-switcher` · `.unit-band`.

---

## 7. Telas / scaffolds incluídos

Cada um é HTML autossuficiente em `scaffolds/` e `preview/`. Para cada um, ver o arquivo correspondente para layout exato.

- **app-shell** — base de toda tela autenticada (sidebar 256px + topbar + conteúdo).
- **prontuario-3col** (flagship) — Contexto (300px) | Evolução (1fr) | Ações (290px). Faixa do paciente no topo; nota clínica com textarea; sinais vitais em grid; CID-10; assinar/concluir.
- **lista-tabela** — busca + filtros + tabela densa com status colorido + paginação por cursor.
- **dashboard-kpi** — `/poncio`, somente leitura, KPIs com drill-down inline + mapa de impacto.
- **wizard** — stepper de 4 passos + tratamento elegante de erro de corrida (overbooking).
- **login-tematico** — porta cerimonial; gradiente da unidade + leão; 6 cores.
- **funil-publico** — inscrição sem login, mobile-first, dados mínimos, consentimento honesto (sem CPF na rota pública).
- **estados** — vazio (por papel) / erro de corrida / sem permissão / loading / offline.
- **cert-capacitacao** — certificado cerimonial (momento WOW): leão grande, QR, confetti, compartilhar no WhatsApp.
- **esportivo-atleta** — radar de atributos 1–5 + grade de presença + visão simplificada da família.
- **recreativo-daily** — captura em 5–10s (foto + tags + nota) → feed da família.
- **preview/** — Login + Home aplicados a Centro Médico (teal) e Capacitação (laranja), lado a lado.

## 8. Interações & comportamento

- **Tema** persistido em `localStorage('ifp-theme')`; alternado por `[data-theme-toggle]`.
- **Seletor de unidade** no hub troca `data-unit` ao vivo.
- **Stepper/wizard**: avança/volta; passo concluído vira ✓; erro de corrida com shake + mensagem que preserva a reserva.
- **Dashboard**: clicar num `.kpi.drill` abre painel de detalhe inline (não navega).
- **Empty states** mudam a mensagem conforme o papel logado.
- **Atos clínicos** (assinar nota) não têm bypass de admin: botão só ativo para o dono.

## 9. Assets

- `public/logo/ifp-symbol.png` — o leão (símbolo). Usar em login, empty (~30% opacidade), certificado (grande), 404/500. Na sidebar, só o símbolo a 32px.
- `public/logo/ifp-lockup.png` — logo com texto. Hero/landing.
- **Pendência:** o login usa gradiente de fallback porque as **fotos institucionais ainda não existem**. Quando chegarem, trocar o `background` do `.login-stage`.

---

## 10. Como implementar no Next.js (App Router + Tailwind)

1. Copie `ifp-tokens.css` e `ifp-components.css` para `src/styles/` e importe no topo do `globals.css`:
   ```css
   @import "./styles/ifp-tokens.css";
   @import "./styles/ifp-components.css";
   ```
2. Coloque `data-theme` no `<html>` (layout raiz) e leia a preferência do usuário (cookie/localStorage). Para `data-unit` (+ `data-unit-accent` na diferenciação forte): **no codebase isto já é resolvido pelo `AppShell` via prop `unit`** — não criar `layout.tsx` de segmento para emitir o atributo (ver §4, "Onde os contratos já são emitidos no app"). Uma unidade nova ganha o acento criando um shell que chama `<AppShell unit="<slug>">`, como `MedicoShell` faz com `unit="medico"`.
3. Transforme as classes em componentes React reutilizáveis (`<Button variant="primary">`, `<Card>`, `<KpiCard>`, `<DataTable>`, `<Stepper>`, `<Toast>`…) mapeando 1:1 para as classes do kit — ou use `@apply` no Tailwind para encapsular cada classe.
4. Não invente cores novas: tudo sai dos tokens. Para um tom intermediário use `color-mix(in srgb, var(--unit) X%, …)` como o kit já faz.
5. Fontes: garanta Hanken Grotesk + IBM Plex Mono (Google Fonts ou `next/font`).

## 11. Arquivos deste pacote

```
HANDOFF.md              ← este documento (entrada)
README.md               ← resumo do kit
ifp-tokens.css          ← ★ fonte da verdade (copiar p/ o projeto)
ifp-components.css      ← ★ componentes (copiar p/ o projeto)
index.html              ← hub navegável (docs vivos)
Preview Login + Home.html
scaffolds/*.html        ← esqueletos de página
preview/*.html          ← Login + Home por unidade
public/logo/*.png       ← leão + lockup
```

---
_Restrições de marca: paleta do brandbook e logos são canônicos — muda só o uso. Direção: clínica premium (não-Editorial)._
