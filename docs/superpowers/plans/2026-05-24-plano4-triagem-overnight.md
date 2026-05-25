# Plano 4 — Núcleo de Triagem — Execução Overnight 2026-05-24

**Spec:** `docs/superpowers/specs/2026-05-24-plano4-triagem-estrutura-design.md`
**Contexto:** Erick autorizou execução autônoma da **fatia estrutural** enquanto dorme. Forks de produto fechados; o que dependia de domínio (Regina), chaves (WhatsApp) ou deploy (link público) está DEFERIDO e documentado na spec — NÃO executar.

## Regras de operação (BLOQUEANTES — herdadas do autopilot de 2026-05-24)

1. **Apenas tarefas T1–T9 abaixo.** Ideia nova → "Backlog descoberto", NÃO executar.
2. **Commit atômico por tarefa**, mensagem clara, rollback fácil.
3. **Push só fast-forward na `main`** — **via git NATIVO do Windows** (`git -C "C:\Users\Administrador\ifp-connect" push origin main` no PowerShell). O push de dentro do WSL trava (wslrelay). Nunca `--force`/rebase.
4. **Schema:** pode mexer em `schema.prisma` SE criar migration (`pnpm db:migrate --name ...`).
5. **Nunca tocar:** `auth.ts` (segurança), `.env.local`/`.env.example` (segredos), `docker-compose.dev.yml` (volumes), settings do GitHub, outros projetos do Erick.
6. **Pre-commit ritual OBRIGATÓRIO** antes de cada commit: `pnpm format && pnpm format:check && pnpm typecheck && pnpm lint && pnpm test`. Só commita se tudo verde.
7. **TDD onde há lógica:** teste primeiro pra função pura, ver falhar, implementar.
8. **Se confuso / decisão de produto aparecer**, PARAR e anotar em "Bloqueado". Não chutar.
9. Todos os comandos rodam DENTRO do WSL (`wsl -d Ubuntu -- bash -c "cd /mnt/c/... && ..."`). Só o `git push` é pelo Windows.

---

## Tarefas (ordem; parar à primeira que peça input)

### T1 — Schema + migration `add_triagem`

- Enums `StatusCadastro {rascunho ativo inativo}`, `StatusTriagem {aberta concluida}`, `StatusElegibilidade {pendente aprovado negado encaminhado}`.
- Model `Triagem` (cidadaoId, assistenteSocialId, dataEntrevista?, parecer? text, observacoes? text, situacaoSocio Json?, status default aberta, createdAt, closedAt?) + relations + `@@index([cidadaoId, createdAt])`, `@@index([status, createdAt])`.
- Model `ElegibilidadeUnidade` (triagemId, unidade, status default pendente, motivo? text, decididoPorId?, decididoEm?) + `@@unique([triagemId, unidade])`, `@@index([unidade, status])`.
- `Cidadao`: `statusCadastro StatusCadastro @default(ativo)` + relation `triagens Triagem[]`.
- `User`: back-relations `triagensConduzidas Triagem[]`, `elegibilidadesDecididas ElegibilidadeUnidade[]`.
- Migration `add_triagem`. **Verificar:** `\d "Triagem"`/`"ElegibilidadeUnidade"` + `pnpm build`.

### T2 — AuditAction + integração com a timeline

- `audit.ts`: `AuditAction` += `triagem_aberta | triagem_concluida | elegibilidade_decidida`.
- `cidadao-history.ts`: `HistoryEventAction` + `ACTION_LABELS` (ex.: "Triagem aberta", "Triagem concluída", "Elegibilidade decidida") + `detalheDe` (elegibilidade → "Centro X: aprovado").
- `historico/page.tsx`: `DOT_COLOR` pras 3 actions.
- **TDD:** estender `tests/unit/cidadao-history.test.ts` (labels + detalhe das novas actions).

### T3 — `lib/triagem.ts` (pure core + I/O shell)

- **Pure (TDD):** `deveAtivarCidadao(elegibilidades): boolean` — true se ≥1 `aprovado`. Teste `tests/unit/triagem.test.ts` primeiro.
- **I/O:** `getTriagem(id, session)`, `listTriagensPendentes(session)`, `getTriagemPorCidadao(cidadaoId, session)` com RBAC (social/super_admin/gestor_geral via `hasAnyRole`/`can`).

### T4 — Server actions `triagem-actions.ts`

- `abrirTriagem(cidadaoId)`, `salvarEntrevista(triagemId, {dataEntrevista, parecer, observacoes})`, `concluirTriagem(triagemId)`, `decidirElegibilidade(triagemId, unidade, status, motivo)`.
- Cada uma: RBAC + `logEvent` com `rootEntityType='cidadao'`, `rootEntityId=cidadaoId` (aparece na timeline).
- `decidirElegibilidade`: se `deveAtivarCidadao` → `cidadao.statusCadastro = ativo`.
- `revalidatePath` da ficha + triagem.

### T5 — UI da triagem

- Botão "Abrir triagem" no detalhe do cidadão (roles social) → cria + navega.
- Página `/app/cidadaos/[id]/triagem` (ou `[triagemId]`): form de entrevista (data, parecer, observações), botão Concluir, e grade de elegibilidade por unidade (4 unidades × select status + motivo).
- Read-only quando `concluida` exceto a elegibilidade.

### T6 — Dashboard social com dados reais

- Trocar os 4 `KpiCard` hardcoded de `/app/social/page.tsx` por: contagem real de triagens `aberta` + lista das pendentes (link pra ficha/triagem). KPIs sem dado real → ocultar ou marcar placeholder explícito.

### T7 — Gestor de unidade: elegibilidades da sua unidade (in-app)

- Em `/app/[unit]/page.tsx`: lista das `ElegibilidadeUnidade` `aprovado`/`encaminhado` da unidade do gestor (read-only). Substitui notificação por e-mail (deferida).

### T8 — e2e `tests/e2e/triagem.spec.ts`

- social abre triagem num cidadão seedado → preenche entrevista → conclui → aprova 1 unidade → cidadão fica `ativo` (verificar no detalhe/badge).
- RBAC: gestor de OUTRA unidade não vê aquela elegibilidade.

### T9 — Fechamento

- Atualizar `[[project-ifp-connect]]` + este log + "Relatório da manhã" abaixo.

---

## NÃO fazer (pedir ao acordar)

- ❌ WhatsApp API (provedor/credenciais) · ❌ Link público + auto-agendamento · ❌ Modelo Vaga/Agendamento · ❌ Regras de elegibilidade automáticas · ❌ Consentimento LGPD · ❌ Subir fora de localhost · ❌ Tocar em auth/.env/docker-compose/outros projetos.

## Bloqueado

_(vazio)_

## Backlog descoberto

_(vazio)_

## Log de execução

| Hora     | Commit    | Task                   | Nota |
| -------- | --------- | ---------------------- | ---- |
| _início_ | `55ddb07` | spec funil + deferrals | —    |

## Relatório da manhã (preencher no fim)

_(a preencher)_

## Próximas perguntas pro Erick (preencher)

1. **WhatsApp API:** qual provedor? (Meta Cloud API / Twilio / Z-API) — precisa credenciais + número.
2. **Vaga/Agendamento:** vaga tem limite de slots? agenda da Regina é por horário? quem confirma o agendamento?
3. **Regras de elegibilidade:** levantar com a Regina os critérios (renda/idade/vaga) por unidade.
