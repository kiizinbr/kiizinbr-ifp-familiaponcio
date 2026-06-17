# LOOP-BACKLOG — fila de construção do IFP Connect (motor do loop)

> **O que é:** a fila priorizada que o loop autônomo consome. Cada iteração pega o
> **próximo item não-feito de menor risco**, implementa usando o design CASA
> (`apps/web/components/casa/*`) e os padrões do módulo, passa pelo **GATE** e
> só então marca como feito.
>
> **GATE obrigatório por item** (nesta ordem; se falhar, NÃO commita — marca `⚠ revisão`):
> 1. `cd apps/web && pnpm typecheck`  2. `pnpm lint`  3. (item de backend) `pnpm --filter @ifp/database exec prisma validate` + gerar migração
> 4. commit pequeno e focado (PT-BR, imperativo)  5. marca `[x]` aqui.
>
> **Regras:** front/reskin/telas-com-API-pronta = autônomo. Backend clínico
> (prescrição, alergia, prontuário) = implementar com cuidado e **deixar para
> validação humana antes de mesclar** (não fazer deploy). Nunca recriar o que já
> funciona — evoluir. Um commit por item. Rodar local (sessão aberta) ou no
> servidor via tmux / `/schedule`.

## ✅ Feito (sessão 2026-06-17)
- [x] Fase 0 — design system CASA em React (Brandmark, CrestAvatar, JubaRing, CoroaSeal, Shell, blocos, nav) + galeria `/casa-ui`
- [x] Reskin **Médico** (shell + refino agenda e prancha SOAP)
- [x] Reskin **Educacional** (shell)
- [x] Reskin **Capacitação** (shell)
- [x] Reskin **Serviço Social** (shell + cor dourada CASA)
- [x] 3 UIs da gestora educacional (comunicados, autorizados, autorização de imagem)
- [x] Agenda médica: navegação de data, dependente, duração

## 🟢 Fila — baixo risco (loop autônomo)
- [ ] Reskin **Família** (mobile) — `ShellMobile` com bottom-nav funcional (Links diário/comunicados/criança)
- [ ] Refino interno das páginas já reskinadas — aplicar blocos (`PageHeader`/`Card`/`Kpi`/`ListRow`/`Pill`) por dentro de: educacional (painel/turma/comunicados/criança), capacitação (painel/turmas/turma/chamada), serviço social (início/fichas/nova/detalhe)
- [ ] Home `/` (hub) — adicionar card do Centro Educacional + ajustar vitrine (tirar Esportivo/Recreativo sem rota)

## 🟡 Fila — novo-front (API já existe; médio)
- [ ] Médico: tela de **beneficiários** liberados (GET /medico/fichas)
- [ ] Educacional: UI de cadastro/revogação de autorizados já existe; conferir cobertura
- [ ] Capacitação: catálogo de cursos / certificados (se API cobre)

## 🔴 Fila — novo-fullstack (precisa backend; revisão humana antes de mesclar)
- [ ] **Prescrição estruturada + bloqueio REAL de alergia** (modelo Prisma + endpoint com checagem server-side + tela na prancha) — segurança do paciente
- [ ] Médico: fila kanban, odontograma, triagem de enfermagem, indicadores, equipe
- [ ] Presidência: Sala de Comando + unidades/impacto/famílias/relatórios (dashboards agregados)
- [ ] Esportivo: módulo do zero (modalidade/turma/frequência/graduação)
- [ ] Site público institucional (`(site)` route group): landing, unidades, doe, voluntário, transparência, contato
- [ ] Admin/Plataforma: usuários/RBAC, unidades, auditoria LGPD, config
- [ ] Auth: recuperar senha, primeiro acesso, switcher de unidade

## Referências para o loop
- Design system: `apps/web/components/casa/` · tokens: `packages/design-tokens/tokens.css`
- Spec visual (como cada tela deve ficar): Atlas em `C:\Users\Erick\Organizado\Projetos\IFP-Instituto\atlas\`
- Backlog clínico detalhado: gap analysis do médico (22 itens) · plano de fases: `docs/PLANO-CASA-PARA-REACT.md`
- Padrão de módulo já reskinado (copiar): `apps/web/app/medico/layout.tsx`
