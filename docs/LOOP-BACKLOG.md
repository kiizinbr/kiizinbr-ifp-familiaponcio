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

## ✅ Feito (sessão 2026-06-17 + reconciliação 2026-06-18)
- [x] Fase 0 — design system CASA em React (Brandmark, CrestAvatar, JubaRing, CoroaSeal, Shell, blocos, nav) + galeria `/casa-ui`
- [x] Reskin **Médico** (shell + refino agenda e prancha SOAP)
- [x] Reskin **Educacional** (shell — preserva console de gestão + chat 1:1 do remoto)
- [x] Reskin **Capacitação** (shell + painel)
- [x] Reskin **Serviço Social** (shell + painel, tema dourado)
- [x] Reskin **Esportivo** (shell — vertical nova do remoto ganhou o Shell CASA na reconciliação)
- [x] Reskin **Família** (mobile) — header CASA com leão + `BottomNavFamilia` (Diário/Comunicados/**Mensagens**/Criança)
- [x] Agenda médica: navegação de data, dependente, duração
- ℹ️ As 3 UIs da gestora educacional (comunicados/autorizados/imagem) vêm do **remoto** (versão mais madura), não do reskin local — por isso o reskin educacional restaurou só o `layout.tsx`.

> **Reconciliação 2026-06-18:** a branch local estava `11↑/19↓`. Reset para o remoto maduro
> (chat 1:1 + Esporte + acesso por unidade + gestão educacional), cherry-pick da fundação CASA
> + médico, e re-aplicação dos reskins sobre as páginas atuais. Os 11 commits antigos ficam
> salvos em `origin/backup/casa-local-2026-06-17`. Gate typecheck+lint verde.

## 🟢 Fila — baixo risco (loop autônomo)
- [ ] Refino interno das páginas já reskinadas — aplicar blocos (`PageHeader`/`Card`/`Kpi`/`ListRow`/`Pill`) por dentro de: educacional (painel/turma/comunicados/criança), capacitação (painel/turmas/turma/chamada), serviço social (início/fichas/nova/detalhe), esportivo (painel/turma)
- [ ] Home `/` (hub) — adicionar card do Centro Educacional + ajustar vitrine (tirar Recreativo sem rota)

## 🟡 Fila — novo-front (API já existe; médio)
- [ ] Médico: tela de **beneficiários** liberados (GET /medico/fichas)
- [ ] Educacional: UI de cadastro/revogação de autorizados já existe; conferir cobertura
- [ ] Capacitação: catálogo de cursos / certificados (se API cobre)

## 🔴 Fila — novo-fullstack (precisa backend; revisão humana antes de mesclar)
- [ ] **Prescrição estruturada + bloqueio REAL de alergia** (modelo Prisma + endpoint com checagem server-side + tela na prancha) — segurança do paciente
- [ ] Médico: fila kanban, odontograma, triagem de enfermagem, indicadores, equipe
- [ ] Presidência: Sala de Comando + unidades/impacto/famílias/relatórios (dashboards agregados)
- [x] ~~Esportivo: módulo do zero (modalidade/turma/frequência/graduação)~~ → ENTREGUE pelo remoto (API + telas + chamada de treino) e reskinado CASA na reconciliação de 18/06
- [ ] Site público institucional (`(site)` route group): landing, unidades, doe, voluntário, transparência, contato
- [ ] Admin/Plataforma: usuários/RBAC, unidades, auditoria LGPD, config
- [ ] Auth: recuperar senha, primeiro acesso, switcher de unidade

## Referências para o loop
- Design system: `apps/web/components/casa/` · tokens: `packages/design-tokens/tokens.css`
- Spec visual (como cada tela deve ficar): Atlas em `C:\Users\Erick\Organizado\Projetos\IFP-Instituto\atlas\`
- Backlog clínico detalhado: gap analysis do médico (22 itens) · plano de fases: `docs/PLANO-CASA-PARA-REACT.md`
- Padrão de módulo já reskinado (copiar): `apps/web/app/medico/layout.tsx`
