# Plano — levar o design CASA para o React (ponte Atlas → app real)

> **Status:** plano aprovado em direção (2026-06-17), execução pendente do "OK" do Erick após o visual do Atlas estar do gosto dele.
> **Princípio inegociável:** o React+NestJS é o **único sistema de produção**. O Atlas CASA
> (`C:\Users\Erick\Organizado\Projetos\IFP-Instituto\atlas\`) é o **design spec** (blueprint visual),
> não um segundo app. Nenhuma tela nova nasce só em HTML depois da Fase 0 — nasce já como componente React.

## Por que assim (e não "design-first puro")
Já existem: backend NestJS maduro, ~23 telas React vivas (4 verticais + Serviço Social) e o Atlas com 67 telas-protótipo. Recriar tudo do zero criaria um 3º artefato divergente. O caminho é **design-system-first**: extrair o CASA como tokens+componentes e aplicá-lo sobre o app real, tela a tela.

## Fase 0 — Extrair o CASA como sistema de design (base de tudo)
Transforma o `casa.css` + `casa-shell.js` em código React reutilizável.
1. **Tokens** → `packages/design-tokens/tokens.css` (já existe parcialmente): consolidar `--papel/--tinta/--dourado`, a tríade `--unidade*` e os seletores `[data-salao=...]` (corte/medico/capacitacao/esportivo/recreativo/social). Fonte: **Jost** (Google Fonts), não Garet.
2. **Componentes-assinatura** → `apps/web/components/casa/`: `CrestAvatar` (clip ogival), `JubaRing` (anel de progresso), `CoroaSeal` (selo de status). Props tipadas; cor por `currentColor`/`var(--unidade)`.
3. **Leão** → `<Brandmark/>` usando o `leao-oficial-mask.png` (importado como asset; `mask-image` + `currentColor`).
4. **Shell** → `apps/web/components/casa/Shell` com 3 modos: `Interno` (topbar+rail; troca cor por `data-theme`/`data-salao`), `Publico` (header/footer de site), `Mobile` (frame família). Hoje cada módulo já tem `layout.tsx` com `data-theme` — evoluir para o shell CASA.
5. **UI base** → migrar `apps/web/components/ui.tsx` (Botao/Campo/Input/Alerta/etc.) para o visual CASA (cards 18px, sombras `--shadow-casa`, pills, kpi, pulso, list-row, tabela).

**Saída da Fase 0:** uma galeria de componentes (Storybook-like ou uma rota `/_casa`) provando que o React renderiza idêntico ao Atlas.

## Fase 1 — Reskin das telas React que já existem (~23)
Aplicar os componentes CASA sobre as telas reais (que já salvam no banco) — **sem recriar**, só trocando a pele.
- Médico: painel, agenda, prontuário SOAP.
- Capacitação: painel, turmas, turma, chamada.
- Educacional: painel, turma do dia, comunicados, criança (as 3 novas telas da gestora entram aqui).
- Serviço Social: início, fichas (lista/nova/detalhe), elegibilidade.
- Família: diário, comunicados, crianças, ficha.
- Comum: login, hub `/`.
Cada reskin valida contra a tela do Atlas correspondente (mesmo nome de módulo).

## Fase 2 — Implementar as telas CASA-only (já desenhadas, faltam no React)
O Atlas é a **especificação** — implementar em React+API:
- **Presidência inteira**: Sala de Comando, unidades, impacto, famílias (agregado anônimo), relatórios.
- Médico: fila kanban, beneficiários, equipe, indicadores, triagem de enfermagem, odontograma.
- Capacitação: catálogo/curso (trilha), sessões/banco de modelos, indicadores.
- Serviço Social: fila de triagem, Ponte da Corte, agenda geral.

## Fase 3 — Porta pública + plataforma (telas novas do zero, já no Atlas)
- **Site institucional** (Route Group `(site)` no mesmo Next.js): landing, unidades, como ser atendido, doe, voluntário, transparência, contato, verificar certificado (este já existe).
- **Auth/Plataforma**: recuperar/primeiro acesso, switcher de unidade, perfil, notificações, busca, 403; **Admin** (usuários/RBAC, unidades, auditoria LGPD, config).

## Fase 4 — Portal Família transversal
Expandir o `/familia` (hoje só Educacional) para diário/agenda/certificados de **todos** os dependentes nas 4 unidades; PWA mobile-first; áudio/literacia baixa.

## Mapeamento Atlas → rota React (convenção)
`<grupo>-<tela>.html` no Atlas ↔ rota no app: `medico-agenda.html` → `/medico/agenda`, `social-ficha-nova.html` → `/servico-social/fichas/nova`, `presidencia-*.html` → `/presidencia/*` (nova), `publico-*.html` → `/(site)/*`, `admin-*.html` → `/admin/*`, `familia-*.html` → `/familia/*`.

## Ordem recomendada de execução
Fase 0 → Fase 1 (reskin, valor imediato no que já funciona) → Fase 2 (Presidência primeiro — é o que a diretoria vê) → Fase 3 (porta pública) → Fase 4. Cada fase: PR próprio, gate de typecheck+lint, validação visual contra o Atlas.
