# Design System v2 — IFP Connect

**Data:** 2026-05-28
**Status:** spec aprovada no brainstorm, aguardando plano de implementação
**Brandbook base:** `C:\intranet-stage\design-lab\BRANDBOOK INSTITUTO_EM CONSTRUCAO (1).pdf`
**Research base:** `docs/superpowers/research/2026-05-28-saas-references-por-vertical.md`
**Spec irmã (estrutural):** `docs/superpowers/specs/2026-05-28-acesso-multitenant-rbac-v2-design.md`

---

## 1. Motivação

Apresentação do IFP Connect à diretoria em 2026-05-28 retornou "parece software de 5 anos atrás" e o pedido de visualizar cada unidade "como se contratasse 1 SaaS por vertical". A spec **Acesso multi-tenant + RBAC v2** (concluída em `352fd18`) entregou a camada estrutural — rotas, login catch-all, gates, RBAC v2. Agora **DS v2 substitui o "Neve provisório"** por identidade visual fiel ao Brandbook IFP oficial, mantendo coerência institucional ao mesmo tempo em que cada unidade ganha um tom temático no momento do login.

## 2. Decisões fechadas no brainstorm

| # | Pergunta | Decisão |
|---|---|---|
| 1 | Direção visual | Seguir brandbook à risca — paleta institucional única |
| 2 | Cor por unidade | NÃO no app autenticado; SIM como filtro do login (6 cores temáticas, todas extraídas do brandbook) |
| 3 | Modo escuro | Só claro nesta spec (YAGNI; spec separada se a operação pedir) |
| 4 | Mascote do leão | Cerimonial: login, certificado, estados vazios, 404. NÃO ubíquo no painel operacional |
| 5 | Verticalização | Tokens compartilhados + componentes-âncora específicos por vertical (specs futuras) |
| 6 | Cor primária da UI | Laranja `#FF772E` como ACCENT (botões CTA, estados ativos); body neutro; marrom `#752C05` para headlines |
| 7 | Densidade visual | Média — entre Doctolib (denso) e Disco (arejado); operacional média-densa, marketing arejado |

## 3. Mapeamento de filtros temáticos por unidade

Cada tela `/[unidade]/login` usa uma cor de filtro extraída do brandbook como overlay sobre a foto de fundo (drone ou foto institucional). A escolha respeita afinidade temática:

| Unidade | Filtro | Hex (brandbook) | Razão temática |
|---|---|---|---|
| Médico | Teal escuro | `#007571` | Saúde, cuidado, frio clínico (universalmente associado) |
| Capacitação | Laranja vibrante | `#FF772E` | Energia, aprendizado, "luz" (é a cor principal de marca) |
| Esportivo | Laranja escuro | `#C24D0F` | Movimento, energia controlada, "fogo" |
| Recreativo | Teal claro | `#10C2BB` | Alegria, leveza, "infantil-mas-sério" |
| Pôncio (executivo) | Marrom queimado | `#752C05` | Sobriedade, hierarquia, autoridade |
| Social (Regina) | Cinza neutro | `#4A4A49` | Transversal, atravessa todas as unidades |

A foto de fundo de cada login vai em `/public/unidades/<slug>/fundo-login.jpg`. Até Erick fornecer, gradiente CSS canônico (filter color escuro ↘ filter color claro) atua como fallback.

## 4. Tokens canônicos (CSS variables)

### 4.1 Paleta institucional

```css
/* Laranja — accent principal */
--ifp-orange-500: #FF772E;    /* primary action, CTAs, estados ativos */
--ifp-orange-700: #C24D0F;    /* primary hover, accent forte */
--ifp-orange-900: #752C05;    /* text headlines, mascote, accent escuro */

/* Teal — success/cuidado/info */
--ifp-teal-500: #10C2BB;      /* success state, info accents */
--ifp-teal-700: #007571;      /* success strong */

/* Neutros (brandbook + complementos derivados) */
--ifp-ink: #4A4A49;           /* body text padrão */
--ifp-canvas: #FFFFFF;        /* surface branco */
--ifp-muted: #6B6B6B;         /* secondary text */
--ifp-surface-50: #FAFAF9;    /* page bg */
--ifp-surface-100: #F4F4F2;   /* card bg sutil */
--ifp-surface-200: #E5E4E1;   /* borders, dividers */

/* Estados especiais (não-brandbook, usar com parcimônia) */
--ifp-danger: #BA1A1A;        /* erros, ações destrutivas */
--ifp-warning: #B45309;       /* alertas (laranja escuro) */
```

### 4.2 Filtros temáticos do login (vide §3)

```css
--ifp-filter-medico: #007571;
--ifp-filter-capacitacao: #FF772E;
--ifp-filter-esportivo: #C24D0F;
--ifp-filter-recreativo: #10C2BB;
--ifp-filter-poncio: #752C05;
--ifp-filter-social: #4A4A49;

/* Opacidade do overlay sobre a foto */
--ifp-filter-opacity: 0.55;
```

### 4.3 Tipografia (Garet)

```css
--ifp-font-family: "Garet", system-ui, -apple-system, "Segoe UI", sans-serif;

/* Pesos disponíveis no brandbook */
--ifp-weight-light: 300;
--ifp-weight-book: 400;
--ifp-weight-regular: 500;
--ifp-weight-bold: 700;
--ifp-weight-heavy: 900;

/* Escala tipográfica (rem) */
--ifp-text-xs: 0.75rem;       /* 12px - micro label, badge */
--ifp-text-sm: 0.875rem;      /* 14px - secondary, form labels */
--ifp-text-base: 1rem;        /* 16px - body */
--ifp-text-lg: 1.125rem;      /* 18px - subtitle, lead */
--ifp-text-xl: 1.5rem;        /* 24px - h3 */
--ifp-text-2xl: 2rem;         /* 32px - h2 */
--ifp-text-3xl: 2.5rem;       /* 40px - h1 página */
--ifp-text-display: 3rem;     /* 48px - hero landing */

/* Line-height por escala */
--ifp-leading-tight: 1.15;    /* hero, headlines */
--ifp-leading-normal: 1.4;    /* títulos médios */
--ifp-leading-relaxed: 1.6;   /* body, parágrafos */

/* Tracking */
--ifp-tracking-tight: -0.01em;    /* headlines */
--ifp-tracking-wide: 0.08em;      /* uppercase labels (estilo brandbook) */
```

> Pendência operacional (§9 deferidas): Garet Light/Regular/Bold `.woff` faltam em `/public/fonts/garet/`. Hoje só temos Book e Heavy. Fallback gracioso pro `system-ui` enquanto Erick não busca os 3 arquivos com a equipe de designer.

### 4.4 Spacing (escala 4px)

```css
--ifp-space-1: 0.25rem;       /* 4px */
--ifp-space-2: 0.5rem;        /* 8px */
--ifp-space-3: 0.75rem;       /* 12px */
--ifp-space-4: 1rem;          /* 16px */
--ifp-space-6: 1.5rem;        /* 24px */
--ifp-space-8: 2rem;          /* 32px */
--ifp-space-12: 3rem;         /* 48px */
--ifp-space-16: 4rem;         /* 64px */
--ifp-space-24: 6rem;         /* 96px */
```

### 4.5 Border radius

```css
--ifp-radius-sm: 6px;         /* inputs, badges, chips */
--ifp-radius-md: 10px;        /* botões, cards pequenos */
--ifp-radius-lg: 16px;        /* cards principais */
--ifp-radius-xl: 24px;        /* shells de login, modais grandes */
--ifp-radius-full: 999px;     /* avatares, pills */
```

### 4.6 Shadows

```css
--ifp-shadow-sm: 0 1px 2px rgba(74, 74, 73, 0.04);
--ifp-shadow-md: 0 4px 12px rgba(74, 74, 73, 0.06);
--ifp-shadow-lg: 0 8px 24px rgba(74, 74, 73, 0.08);
--ifp-shadow-xl: 0 16px 48px rgba(74, 74, 73, 0.12);    /* hero, modais */
```

### 4.7 Transitions

```css
--ifp-transition-fast: 120ms ease-out;     /* hover, focus, color */
--ifp-transition-base: 200ms ease-out;     /* abertura de menu, modal */
--ifp-transition-slow: 320ms ease-out;     /* page transition */
```

## 5. Componentes universais

### 5.1 Botão (variants: primary, secondary, ghost, danger)

**Primary**: background `--ifp-orange-500`, text branco, hover `--ifp-orange-700`. Para ações CTA principais.

**Secondary**: border 1.5px `--ifp-orange-900` (e text), background transparente. Hover: bg `--ifp-orange-900` 5%. Para ações secundárias.

**Ghost**: sem border, text `--ifp-ink`, hover: bg `--ifp-surface-100`. Para ações terciárias inline.

**Danger**: background `--ifp-danger`, text branco. Para destruição irreversível (excluir cidadão, cancelar agendamento).

**Tamanhos**: sm (padding 6×12, font 13px), md (padding 10×16, font 14px), lg (padding 12×20, font 16px).

Todos: radius `--ifp-radius-md`, font `Garet Bold`, transition `--ifp-transition-fast`, disabled = opacity 0.5 + cursor not-allowed.

### 5.2 Input / Select / Textarea

- Background `--ifp-canvas`, border 1px `--ifp-surface-200`, radius `--ifp-radius-sm`
- Padding 10×12, font `Garet Regular 14px`, color `--ifp-ink`
- Focus: border `--ifp-orange-500`, ring 2px `--ifp-orange-500` @ 20% opacity
- Erro: border `--ifp-danger`, mensagem abaixo em `--ifp-danger`
- Label acima em `--ifp-text-sm Garet Book` (color `--ifp-muted`)
- `useId()` em todos (a11y — já implementado em T3 do Plano 3)

### 5.3 Card

- Background `--ifp-canvas`, border 1px `--ifp-surface-200`, radius `--ifp-radius-lg`
- Padding `--ifp-space-6`, shadow `--ifp-shadow-sm`
- Hover (se clicável): shadow `--ifp-shadow-md`, border `--ifp-surface-200` → transparente, lift 2px
- Variante "outline accent": border-top 4px na cor temática da unidade (já usado em /landing e /poncio)

### 5.4 Badge

- Padding 2×8, radius `--ifp-radius-full`, font `Garet Bold 11px uppercase tracking-wide`
- Variants:
  - Default: bg `--ifp-surface-100`, text `--ifp-muted`
  - Success: bg `--ifp-teal-500` @ 15%, text `--ifp-teal-700`
  - Warning: bg `--ifp-orange-500` @ 15%, text `--ifp-warning`
  - Danger: bg `--ifp-danger` @ 12%, text `--ifp-danger`
  - Info: bg `--ifp-orange-900` @ 10%, text `--ifp-orange-900`

### 5.5 AppShell (sidebar lateral existente)

- Sidebar 256px, background `--ifp-canvas` com transparência sutil (`bg-white/85` + backdrop-blur)
- Border-right 1px black 7%
- Logo IFP (`ifp-symbol.png` 32×32) + "IFP Connect" `Garet Heavy 17px`
- SidebarNav: items `Garet Bold 14px`, padding 8×12, hover bg `--ifp-surface-100`, active bg `--ifp-orange-500` @ 8% + text `--ifp-orange-900`
- UnitSwitcher: só pra super_admin (T11 já entregou); usa tokens novos
- Avatar + Sair no rodapé fixo
- Conteúdo principal: max-w 1200px, padding `--ifp-space-8`

### 5.6 UnidadeLoginShell

- Background = foto da unidade (foto drone ou institucional do local) ocupando 100% da viewport
- Overlay: cor de `--ifp-filter-<unidade>` com opacidade `--ifp-filter-opacity` (0.55)
- Card central: 384px max-width, `bg-white/95 backdrop-blur`, radius `--ifp-radius-xl`, padding 32, shadow `--ifp-shadow-xl`
- Mascote: `/logo/ifp-symbol.png` 56×56 centralizado
- Nome da unidade: `Garet Bold 18px`, `--ifp-orange-900`
- Sub-título "Instituto Família Pôncio" `Garet Light 12px uppercase tracking-wide`, `--ifp-muted`
- Form: já implementado em T7

### 5.7 Empty State

Componente reutilizável `<EmptyState mascote="leao" titulo="..." descricao="..." cta?>`:

- Mascote `ifp-symbol.png` 96×96 em opacity 30% (sutil, não dominante)
- Título `Garet Bold 18px`, `--ifp-ink`
- Descrição `Garet Regular 14px`, `--ifp-muted`, max-w 320px center
- CTA opcional (botão secundário)

Casos de uso:
- "Você ainda não tem cidadãos cadastrados" + "Criar primeiro"
- "Sem triagens pendentes" (Regina)
- "Nenhuma vaga aberta no mês" (Raquel)

## 6. Mascote do leão — uso permitido

**Sim:**
- Tela de login (`/[unidade]/login`) — 56×56 no card central
- Landing pública `/` — 48×48 no header
- Estados vazios — 96×96 com opacidade 30%
- Certificado de conclusão (capacitação) — escala grande, ato cerimonial
- 404 / 500 — escala média, mensagem amigável
- Página de boas-vindas pós-primeiro-login (futura)

**Não:**
- Sidebar permanente (já tem o `ifp-symbol` pequeno no header)
- Headers de páginas operacionais (agenda, ficha, lista)
- Modais de confirmação
- Toasts/notificações
- Documentos administrativos

## 7. Verticalização por unidade (esta spec NÃO entrega)

Cada vertical ganha sua spec própria depois. Esta spec só define o cabeçalho do mapa:

| Unidade | Tela-âncora futura | Componente-âncora |
|---|---|---|
| Médico | Agenda semanal + fila do dia | `<AgendaSemanal>` + `<FilaDoDia>` |
| Capacitação | Trilha do aluno + grade de turmas | `<TrilhaProgresso>` + `<TurmasGrid>` |
| Esportivo | Calendário treinos + evolução radar | `<CalendarioTreinos>` + `<RadarEvolucao>` |
| Recreativo | Daily report + mensagens família | `<DailyFeed>` + `<MensagensFamilia>` |
| Pôncio | Dashboard executivo agregado | (placeholder T9 reaproveitado) |
| Social | Triagem cross-unidade | (placeholder T8 reaproveitado) |

Cada componente-âncora vira spec dedicada quando for verticalizar.

## 8. Telas que recebem migração nesta spec

Esta spec define tokens + componentes universais. As tasks de implementação aplicam os tokens nas telas existentes:

1. `globals.css` — declarar CSS variables canônicas + carregar Garet (todos os pesos disponíveis)
2. `app/page.tsx` (landing) — aplicar tokens, mascote 48×48 no header
3. `app/[unidade]/login/page.tsx` + `UnidadeLoginShell` — trocar `corPrimariaPlaceholder` por `--ifp-filter-<slug>` real
4. `app/[unidade]/page.tsx` — usar tokens; remover banner "visual provisório"
5. `app/social/page.tsx`, `app/poncio/page.tsx` — usar tokens; remover banner
6. `lib/unidades.ts` — substituir `corPrimariaPlaceholder` hex inventado pelos canônicos do brandbook
7. AppShell — refator tokens + Garet em hierarquia
8. Componentes existentes (KpiCard, SidebarNav, AnexoUploader, TriagemForm, etc.) — adaptar aos novos tokens

## 9. Decisões deferidas

| Item | Responsável | Quando |
|---|---|---|
| Foto institucional/drone de cada unidade (6 imagens) | Erick busca com equipe de designer | Até semana seguinte |
| Garet Light/Regular/Bold (`.woff`) | Erick busca com equipe | Antes da impl pra hierarquia completa |
| Componentes-âncora específicos por vertical | Spec futura por unidade | Após DS v2 |
| Modo escuro | Spec separada se a operação pedir | Indefinido |
| Sistema de toast/notificação | Spec futura | Indefinido |
| Tabela de dados padronizada | Spec futura | Indefinido |
| Componentes de gráfico (radar, line, bar) | Spec futura (necessário pra esportivo + poncio) | Junto com verticalização |
| Documentação Storybook | Spec futura | Quando o DS v2 estabilizar |

## 10. Critérios de sucesso

- [ ] Tokens canônicos declarados em `globals.css`
- [ ] Componentes universais (`Button`, `Input`, `Card`, `Badge`, `EmptyState`) extraídos em `src/components/ui/`
- [ ] `lib/unidades.ts` usa filtros canônicos do brandbook (não mais hex que Claude inventou)
- [ ] Login catch-all renderiza com filtros temáticos por unidade visivelmente distintos
- [ ] Mascote presente em landing + login + estados vazios + 404
- [ ] Banner "visual provisório" sai das telas `/[unidade]`, `/social`, `/poncio`
- [ ] AppShell aplica hierarquia tipográfica Garet em todos os pesos disponíveis
- [ ] `pnpm typecheck && pnpm lint && pnpm test` verdes
- [ ] E2e existente não regride (todos os testes que passavam antes continuam passando)
- [ ] Smoke visual: usuário Erick loga em cada uma das 6 unidades e cada login tem cor distinta + foto correta

## 11. Não-objetivos (fora desta spec)

- Componentes-âncora específicos por vertical (Doctolib-like agenda, Disco-like trilha, etc.)
- Modo escuro
- Implementação real de KPIs no `/poncio` ou triagem no `/social` (continuam placeholders funcionais)
- Migração de sub-rotas internas (`/app/cidadaos`, `/app/vagas`) — fica pra spec de verticalização
- Foto real das unidades (pendência operacional Erick)
- Storybook / documentação visual gerada
- Refator de modelos de domínio

## 12. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Garet Light/Regular/Bold demora a chegar | Fallback gracioso pra `system-ui` + Book/Heavy disponíveis; hierarquia visual ainda funciona porque tamanho diferencia mais que peso |
| Foto fundo do login ainda não fornecida | Gradient CSS canônico em cada unidade atua como fallback (já implementado em T7) |
| Componentes existentes podem mudar visualmente após adoção de tokens | Smoke browser manual nas 6+ telas-chave após cada task da implementação |
| Token `--ifp-space-X` conflitar com classes Tailwind 4 | Manter Tailwind como motor principal; usar CSS variables apenas onde precisa do token canônico (ex.: filter color do login que é dinâmico) |
| Brandbook ainda "em construção" → mudanças futuras na paleta | Toda token está em variável central; mudança em `globals.css` propaga pra todo lugar |

## 13. Dependências

- Spec **Acesso multi-tenant + RBAC v2** (concluída em `352fd18`)
- Brandbook IFP (em construção, mas paleta + tipografia + mascote estáveis)
- Tailwind 4 (já no projeto)
- Garet Book + Heavy `.woff` (já self-hosted em `/public/fonts/garet/`)
- Mascote `/logo/ifp-symbol.png` (já no projeto)

## 14. Estimativa grossa

Plano subsequente detalhará tasks. Orientativa: 8–12 tasks, 1–2 dias TDD focado. Não bloqueia outras frentes (verticalização por unidade pode brainstormar em paralelo).
