# IFP Connect · Design Kit

Fundação visual + scaffolds de página para o **IFP Connect**, na direção **"Ferramenta Clínica Premium"** (validada no mockup do prontuário). Não é um app — é a base que toda tela futura forka.

Abra **`index.html`** para o kit navegável (fundação + componentes + galeria de scaffolds).

## Estrutura

```
index.html                 → hub navegável (docs vivos)
ifp-tokens.css             → tokens canônicos do brandbook + camada semântica claro/escuro  ◀ fonte da verdade
ifp-components.css         → componentes (botão, input, card, badge, kpi, tabela, timeline, stepper, toast, modal, app-shell…)
scaffolds/                 → esqueletos de página autossuficientes (clicáveis no hub)
  app-shell.html           → sidebar 256px + topbar + conteúdo  (base de toda tela autenticada)
  prontuario-3col.html     → Contexto | Evolução | Ações  (flagship clínica)
  lista-tabela.html        → lista densa: busca + filtros + status + paginação por cursor
  dashboard-kpi.html       → /poncio: KPIs + drill-down inline + mapa de impacto
  wizard.html              → stepper de N passos + erro de corrida elegante
  login-tematico.html      → porta cerimonial · 6 cores de unidade
  funil-publico.html       → inscrição sem login, mobile-first, consentimento honesto
  estados.html             → vazio / erro / sem permissão / loading / offline
  cert-capacitacao.html    → certificado cerimonial (WOW): leão grande + QR + confetti
  esportivo-atleta.html    → radar 1–5 + presença + visão simplificada da família
  recreativo-daily.html    → captura 5–10s (foto + tags + nota) + feed da família
  scaffold-chrome.{css,js} → só para a demo (toggle de tema + pílula "voltar"); REMOVER ao forkar
public/logo/               → ifp-symbol.png (leão) · ifp-lockup.png (com texto)
```

## Handoff para o Next.js (App Router + Tailwind)

1. Copie `ifp-tokens.css` e `ifp-components.css` para `src/styles/` e importe no topo do `globals.css`:
   ```css
   @import "./styles/ifp-tokens.css";
   @import "./styles/ifp-components.css";
   ```
2. Os nomes `--ifp-*` (paleta) e os triplets RGB já batem com o `globals.css` atual do repo.
3. Tema: `<html data-theme="light|dark">`. Sotaque de unidade: `<body data-unit="medico|capacitacao|esportivo|recreativo|poncio|social">` → define `--unit` para faixas e selos.
   - Para diferenciação **mais evidente**, adicione também `data-unit-accent` no `<body>`: o acento da interface (botões, item de menu ativo, ícones, foco, links) passa a seguir a cor da unidade — sem mudar tipografia, layout nem o fundo universal.
4. As classes (`.btn`, `.card`, `.kpi`, `.tbl`, `.badge`…) viram componentes React 1:1, ou alimentam `@apply` no Tailwind.

## 6 regras que mantêm "uma marca só"

1. **Cor = sinal funcional.** App autenticado é 1 marca IFP; a cor da unidade é faixa/selo discreto. A explosão de cor fica no login.
2. **Densidade vs. acolhimento.** Equipe = denso (info por pixel). Cidadão/família = respiro e calor.
3. **Leão.** SIM em login, landing, empty (30%), certificado (grande), 404/500. NÃO em sidebar (só símbolo 32px), headers operacionais, modais, toasts.
4. **Empty states por papel.** A mensagem muda com quem está logado.
5. **Atos clínicos pessoais.** Editar/assinar nota não tem bypass de admin — botão só ativo para o dono.
6. **Consentimento honesto.** Público vulnerável: checkbox desmarcado, linguagem clara, sem CPF/dados sensíveis na rota pública.

## Fontes
UI **Hanken Grotesk** · dados/números/labels **IBM Plex Mono** (carregadas via Google Fonts em `ifp-tokens.css`).

---
_Restrições duras de marca: paleta do brandbook e os logos são canônicos — mudar só o **uso**, nunca os valores._
