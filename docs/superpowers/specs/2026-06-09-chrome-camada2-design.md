# Spec + Plano — Chrome de Navegação "Camada 2 visual" (IFP Connect)

**Data:** 2026-06-09
**Origem:** track P0 paralelo (redesenho de navegação, opção A = kit-canônico). Produzido por workflow multi-agente (`ifp-chrome-camada2-design`), derivado do scaffold `docs/design-kit/scaffolds/app-shell.html` + `src/styles/ifp-components.css` (REGRA DURA: não inventar UI, derivar do kit).
**Status:** design pronto. Execução pendente (fase própria — começar pela FASE A, a única crítica).

---

## SPEC

### Problema

O chrome React (`AppShell` + `SidebarNav` + `MedicoHeader`) divergiu do scaffold canônico do Design Kit. As primitivas do kit existem e estão importadas no `globals.css`, mas o React não as usa. Cinco divergências, uma **crítica de acessibilidade/responsividade**:

1. **CRÍTICO — sem navegação <880px.** O kit faz `.sidebar { display:none }` abaixo de 880px (`ifp-components.css:1079-1081`) e o React não tem topbar, hambúrguer, drawer ou overlay. Em telas estreitas o usuário **fica sem nenhuma navegação** — nem trocar de tela, nem sair, nem alternar tema (tudo isso mora no rodapé da sidebar, `app-shell.tsx:90-135`).
2. **Topbar ausente.** O React vai direto de `<aside class="sidebar">` para `<main><div class="content">` (`app-shell.tsx:138`). O kit prescreve `<header class="topbar">` sticky com `.tb-title`, `.spacer`, `.input-search` (280px) e `.toggle-pill` de tema (`app-shell.html:49-60`; `.topbar` em `ifp-components.css:990-1010`).
3. **Sidebar plana.** `SidebarNav` (`sidebar-nav.tsx:13-33`) renderiza lista linear sem `.sb-group`. O kit prescreve grupos nomeados — "Operação", "Cadastros", "Conta" — via `.sb-group` (`ifp-components.css:943-951`). `NavItem` (`sidebar-nav.tsx:7-10`) só tem `{ label, href }`.
4. **Itens transversais misturados.** Em `medicoNavItems` (`src/lib/medico/nav.ts:36-38`) e `capacitacaoNavItems` (`src/lib/capacitacao/nav.ts:23-24`), "Cidadãos"/"Configurações" são append direto sem separador.
5. **MedicoHeader paralelo ao `.page-head`.** `MedicoHeader` (`medico-shell.tsx:32-79`) reimplementa o cabeçalho com inline styles espelhando `.page-head` + `.actions` (`ifp-components.css:1058-1073`) sem usar as classes. `UnitSwitcher` está condicionado a `super_admin` e DEPOIS da nav (`app-shell.tsx:83-88`), enquanto o scaffold o coloca abaixo do `.sb-brand` (`app-shell.html:26-29`).

### Modelo-alvo (derivado do scaffold)

```
.shell
├─ <aside class="sidebar">
│   ├─ .sb-brand            (logo + "IFP Connect")          ← já existe
│   ├─ .unit-switcher       (logo abaixo do brand)          ← mover pra cá
│   ├─ .sb-group "Operação" + .nav-item[]                   ← NOVO agrupamento
│   ├─ .sb-group "Cadastros" + .nav-item[]                  ← NOVO agrupamento
│   ├─ <div style="margin-top:auto">                        ← spacer
│   └─ .sb-group "Conta" + .nav-item (perfil/sair/tema)     ← rodapé reorganizado
└─ <div>  (wrapper do main)
    ├─ <header class="topbar">  .tb-title · .spacer · .input-search · .toggle-pill   ← NOVO
    └─ <div class="content">
        └─ .page-head  (.ph-sub + h1.t-h1 + .actions)        ← migrar MedicoHeader
            └─ {children}
```

**Decisões (Opção A):** sidebar agrupada por `section` (novo campo opcional em `NavItem`, agrupado preservando ordem de 1ª aparição; grupos: Operação/Cadastros/Conta); topbar sticky com título (prop)+busca(visual)+tema (move `ThemeToggle` pra cá); barra de ação = `.page-head .actions` (lar de `SubmitButton`/`ConfirmDialog`); drawer <880px reusando a MESMA `<aside class="sidebar">` sobre overlay (trap de foco, Esc fecha, foco volta ao hambúrguer, fecha ao navegar, `prefers-reduced-motion`); nav ciente-de-papel PRESERVADA (só anexar `section`, sem tocar `pode*`/`hasAnyRole`).

**Nenhuma classe CSS nova** — tudo já existe em `ifp-components.css`; só o drawer/overlay precisa de regras `@media (max-width:880px)` extras (overlay + slide-in) reusando tokens existentes (`--surface`/`--line`/`--t-fast`/`--shadow`), sem cor nova.

### Como NÃO quebrar os shells que funcionam (migração aditiva)

1. `NavItem.section` **opcional** — call-sites atuais compilam sem o campo; itens sem `section` formam o 1º bloco sem `.sb-group` (idêntico ao atual).
2. `sectionLabel` continua aceito como fallback (vira rótulo do bloco único se ninguém usar `section`).
3. `AppShell` ganha `title?` opcional — topbar renderiza sem `.tb-title` quando ausente.
4. `MedicoHeader` mantém a assinatura (`eyebrow`/`titulo`/`descricao`/`acao`) — só muda a implementação interna; nenhuma página `/medico/*` muda.
5. `UnitSwitcher` movido (não removido); condição `super_admin` intacta.
6. Fatiar o `<aside>` num `Sidebar` reusado por desktop+drawer (evita drift da nav).

### Fora de escopo

Lógica de negócio da busca (só chrome visual); qualquer mudança de RBAC; ícones SVG dos `.nav-item` (polimento incremental); persistência de tema; reescrita das telas internas.

---

## PLANO (TDD-aware, bite-sized)

Lógica pura em `tests/unit` (Vitest node-only); UI por `pnpm build` + Playwright. Classe condicional via `clsx`/`cn`. Ordem: **(A) topbar+drawer** (mata o crítico <880px) → **(B) sidebar agrupada** → **(C) page-head/MedicoHeader**.

### FASE A — Topbar + drawer mobile (CRÍTICO <880px)

- **A1.** CSS drawer/overlay no `ifp-components.css` dentro do `@media (max-width:880px)`: `.sidebar.drawer-open` (fixed, z-40, 256px, slide-in), `.sidebar.drawer` fechado (`translateX(-100%)`, `transition var(--t-fast)`), `.drawer-overlay` (z-39, `color-mix(--text 45%, transparent)`), `.topbar .tb-burger` (visível só ≤880px), `prefers-reduced-motion` zera transição. Só tokens existentes.
- **A2.** Hook `use-drawer.ts` + parte PURA `focus-trap.ts` (`nextFocusIndex`, `shouldCloseOnKey`) testada em `tests/unit/ui/use-drawer.test.ts` (precedente: `button-classname.test.ts`). Hook: `isOpen/open/close/toggle`, Esc fecha, trap de foco, devolve foco ao trigger, fecha em mudança de `pathname`, cleanup no unmount.
- **A3.** `topbar.tsx` (client): `<header class="topbar">` com `.tb-burger` (`onMenuClick`, `aria-expanded`, `aria-controls`), `.tb-title` (se `title`), `.spacer`, `.input-search` (visual), `<ThemeToggle/>` movido. Props `{ title?, onMenuClick, isMenuOpen }`.
- **A4.** Extrair `<Sidebar>` (de `app-shell.tsx:72-136`) reusado por desktop+drawer; fiar topbar+drawer no AppShell (extrair casca interativa `AppShellChrome` client, manter `AppShell` RSC repassando `session`/`signOutAction`). Mover `<main>` pra dentro do wrapper `<div>`. `title?` em `AppShellProps`. **Verify:** medico/capacitação compilam sem mudança.
- **A5.** E2E `tests/e2e/chrome-drawer.spec.ts`: 375px → hambúrguer abre drawer, Tab preso, Esc fecha+devolve foco, overlay fecha; 1024px → hambúrguer oculto. Screenshots 320/768/880/1024 light+dark.

### FASE B — Sidebar agrupada (`.sb-group`) + nav ciente-de-papel

- **B1.** `section?` em `NavItem` + `groupNavItems` puro em `src/lib/nav-groups.ts` (preserva ordem, grupos vazios somem, imutável) + `tests/unit/nav-groups.test.ts` (RED→GREEN).
- **B2.** `SidebarNav` chama `groupNavItems` e emite `.sb-group` por grupo; `active`/`aria-current` intactos; `key` por `href`.
- **B3.** Anotar `section` nos builders (`medico/nav.ts`, `capacitacao/nav.ts`, `defaultItems`): unidade→"Operação", Cidadãos→"Cadastros", Configurações→"Conta". **Sem tocar RBAC.** Estender `tests/unit/nav.test.ts` com asserts de `section` por papel.
- **B4.** Reposicionar `UnitSwitcher` abaixo do `.sb-brand` (condição `isSuper` intacta).

### FASE C — Barra de ação (`.page-head .actions`) + MedicoHeader

- **C1.** `page-head.tsx`: `PageHead({ eyebrow?, titulo, descricao?, acao? })` com `.page-head`/`.ph-sub`/`h1.t-h1`/`.actions` (sem inline styles). `acao` = slot de `SubmitButton`/`ConfirmDialog`.
- **C2.** `MedicoHeader` delega a `PageHead` (assinatura intacta; remove inline styles `medico-shell.tsx:44-77`).
- **C3.** (opcional) `CapacitacaoHeader` via `PageHead` (paridade).
- **C4.** E2E `chrome-page-head.spec.ts`: `.page-head .actions`/`h1.t-h1`/`.ph-sub` presentes; `acao` dentro de `.actions`; screenshots 768/1440 dois temas.

### Fechamento (por fase)

Ritual via WSL (`pnpm format && format:check && typecheck && lint && test`; exit-code via `.sh`), `pnpm build` antes do push, commit por fase (ASCII, sem aspas duplas), push git nativo Windows. **Executar uma fase por vez** (A primeiro — única crítica) e verificar antes de seguir.

---

## Gaps mapeados (resumo do workflow)

Topbar ausente · sidebar plana sem grupos · transversais misturados · sem drawer <880px (CRÍTICO) · MedicoHeader vs `.page-head` · UnitSwitcher fora do lugar · nav-item sem ícone SVG · container do main sem semântica de topbar.
