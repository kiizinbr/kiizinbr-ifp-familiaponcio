# Auditoria Geral IFP Connect — Relatório Acionável

**Data:** 2026-06-14
**Auditor-chefe:** consolidação de auditoria estática (leitura de código) + runtime por papel (staging `https://ifp-app.taile04c66.ts.net`)
**Base:** 27 achados alta/média verificados adversarialmente + 40 achados baixos (estáticos, não re-verificados em runtime). Após dedup: **~52 itens únicos**.

---

## SUMÁRIO

### Contagem por severidade (itens únicos, pós-dedup)
| Severidade | Qtde |
|---|---|
| 🔴 Alta | 2 |
| 🟠 Média | 13 |
| 🟡 Baixa | 37 |
| **Total** | **~52** |

### Contagem por área
| Área | Total | Alta | Média | Baixa |
|---|---|---|---|---|
| medico | 18 | 2 | 5 | 11 |
| cidadaos | 12 | 0 | 4 | 8 |
| capacitacao | 11 | 0 | 3 | 8 |
| acesso | 6 | 0 | 0 | 6 |
| hub | 7 | 0 | 2 | 5 |
| painel | 4 | 0 | 1 | 3 |
| outro | 1 | 0 | 0 | 1 |

> As contagens por área somam mais que 52 porque alguns achados deduplicados eram contados em mais de uma área/lista; a coluna de severidade reflete o estado pós-dedup.

### TOP 5 PRIORITÁRIOS (severidade × ROI)
1. **[ALTA · medico · rbac]** IDOR multi-tenant: nenhuma action do Médico valida a unidade do cidadão (`assertAcessoCidadao` nunca usado em `/medico/**`). Vaza/escreve PHI de paciente de outra unidade. **Fix:** plugar `assertAcessoCidadao(session, cidadaoId)` no topo de toda action/page de `/medico` que recebe `cidadaoId`, e filtrar `db.cidadao.find*` por `unitIdOrigem` na busca da recepção/`pacientes/[id]`.
2. **[ALTA · medico · rbac]** Gestor/super_admin emite receita/atestado assinados sob o CRM do médico (impersonação de documento legal). **Fix:** restringir `podeEmitirDocumento` ao profissional dono (`session.user.id === consulta.profissional.userId`), ou exigir co-assinatura do prescritor antes de congelar o snapshot.
3. **[MÉDIA · cidadaos · bug]** "Carregar mais" descarta TODOS os filtros (q/unidade/status/ciclo) e reverte status para `ativo` — pode mostrar excluídos/anonimizados sem o operador perceber. **Fix:** montar o href com `URLSearchParams` preservando todos os params + cursor; validar `status` contra o enum no servidor.
4. **[MÉDIA · cidadaos · rbac]** Status "Excluídos" e "Anonimizados (LGPD)" da lista acessíveis a qualquer login (inclui recepção) — expõe PII integral de fichas soft-deleted. **Fix:** restringir os status `deletado`/`anonimizado` a super_admin/gestor no `<select>` E no filtro de `listCidadaos` (servidor).
5. **[MÉDIA · medico · rbac]** Profissional reescreve o próprio conselho/nº CRM (credencial legal) sem aprovação da gestão. **Fix:** no branch `ehProprio` de `atualizarProfissionalAction`, bloquear edição de `conselho`/`nroConselho`/`especialidades` (allowlist de campos self-edit: só `nomeExibicao`/`bio`).

---

## 🔴 O QUE ESTÁ ERRADO
*(bugs / rbac / dados / falha-silenciosa — ranqueado por severidade, depois por ROI)*

### ALTA

#### A1 · medico · rbac · IDOR multi-tenant em todo o /medico
- **Onde:** `src/app/medico/consultas/nova/actions.ts` (reservar/criarSlotAdHoc/atenderAgora); `src/app/medico/consultas/[id]/encaminhamento-actions.ts` e `documento-actions.ts`; `src/app/medico/encaminhamentos/actions.ts`; `src/app/medico/pacientes/[id]/page.tsx:57`; guard existente não usado: `src/lib/cidadao-authz.ts:33` (`assertAcessoCidadao`).
- **Evidência:** Todas as actions só checam `canAccessUnidade(session,'medico')` + role; nunca carregam o cidadão para conferir `cidadao.unitIdOrigem`. `assertAcessoCidadao` (criado exatamente para isso) só é importado em `cidadaos/[id]/consentimento-actions.ts` — **zero** imports em `/medico`. `pacientes/[id]/page.tsx` faz `findUnique({where:{id}})` sem filtro, lê notas assinadas + vitais (linhas 73-97) e só **depois** loga `medical_data_accessed` (linha 99). `nova/page.tsx:99-111` busca cidadãos de TODAS as unidades. Repro: recepção/gestor de `medico` forja `cidadaoId` de outra unidade → agenda, emite documento e LÊ timeline clínica de paciente alheio.
- **Severidade:** ALTA (confirmado, não refutável; LGPD art. 11 — PHI).
- **Fix:** Inserir `await assertAcessoCidadao(session, cidadaoId)` no início de cada action/page de `/medico` que recebe `cidadaoId`, e escopar as buscas (`pacientes/[id]`, `nova/page` findMany, recepção) por `unitIdOrigem`.

#### A2 · medico · rbac · Gestor emite documento legal sob o CRM do médico
- **Onde:** `src/lib/medico/rbac.ts:127` (`podeEmitirDocumento`); `src/app/medico/consultas/[id]/documento-actions.ts:46-51,109-120,146-158`.
- **Evidência:** `podeEmitirDocumento` retorna `true` incondicionalmente para super_admin/gestor_unidade (só role, sem ownership). `emitirReceitaAction`/`emitirAtestadoAction` congelam o snapshot com `consulta.profissional.nomeExibicao/conselho/nroConselho` — o ator real só aparece no `logEvent`. Os PDFs (`receita-pdf.tsx:146-153`, `atestado-pdf.tsx:138-145`) desenham a linha de assinatura com nome + CRM do médico. Incoerência explícita: `podeAssinarNota` nega super_admin ("ato pessoal §0.4") e `podeEditarNota` nega gestor ("§0.3"), mas `podeEmitirDocumento` libera ambos. Repro: gestor_unidade@medico abre consulta de qualquer médico → PDF sai assinado com o CRM do médico.
- **Severidade:** ALTA (parece design deliberado/testado, mas é integridade RBAC / impersonação de documento legal — regra CFM).
- **Fix:** Exigir `session.user.id === consulta.profissional.userId` em `podeEmitirDocumento` (gestor não emite documento que carrega CRM de terceiro), ou introduzir co-assinatura/aprovação do prescritor.

### MÉDIA

#### M1 · cidadaos · bug · "Carregar mais" descarta filtros (q/unidade/status/ciclo)
- **Onde:** `src/app/app/cidadaos/page.tsx:234`.
- **Evidência (dedup: estático + 2× runtime):** `href={`/app/cidadaos?cursor=${nextCursor}`}` — só o cursor. Form é `method=get`; a página lê params 55-74. Página 2 carrega com params `undefined` → vira lista geral. Pior: `listCidadaos` faz `status = filters.status ?? "ativo"` (`cidadao.ts:77`), então a página 2 **reverte silenciosamente** o status filtrado (Excluídos/Anonimizados) para `ativo`, com cursor aplicado sobre conjunto diferente. Runtime confirmou href `/app/cidadaos?cursor=cmq4f9dj504ycpe10365unguy`. Screenshot: `overnight-AUDIT/cidadaos-lista-dados-sujos-status.png`.
- **Severidade:** MÉDIA (correção + ângulo LGPD; dispara com >50 registros; sem bypass de unidade).
- **Fix:** Construir o href com `URLSearchParams` reanexando q/unidade/status/ciclo + cursor; validar `status` contra o enum no servidor.

#### M2 · cidadaos · rbac · Excluídos/Anonimizados acessíveis a qualquer login
- **Onde:** `src/app/app/cidadaos/page.tsx:140-144`; `src/lib/cidadao.ts:77-83,110-124`.
- **Evidência:** `<select name="status">` oferece `ativo|deletado|anonimizado` sem gate de papel; `params.status` repassado sem validação de enum nem checagem de role. `listCidadaos` só aplica escopo de **unidade** — o eixo de compliance (`deletedAt`/`anonimizadoEm`) não tem gate de papel. Recepção lista a "lixeira" da própria unidade com PII integral (nome/CPF/telefone/nascimento). A tabela renderiza dados crus sem redação. Nuance: "anonimizados" já têm PII mascarada em repouso (menos grave); "excluídos" é a exposição real.
- **Severidade:** MÉDIA (PII de soft-deleted a perfil operacional; confinado à unidade, view-only).
- **Fix:** Validar `params.status` contra o enum e restringir `deletado`/`anonimizado` a super_admin/gestor — tanto na opção do select quanto no filtro de `listCidadaos`.

#### M3 · medico · rbac · Profissional reescreve o próprio CRM sem aprovação
- **Onde (dedup: estático + runtime):** `src/app/medico/profissionais/actions.ts:55-88` (branch `ehProprio`); `src/app/medico/profissionais/[id]/page.tsx:34,83-148`.
- **Evidência:** `ehProprio = session.user.id === prof.userId`; no ramo self-edit grava livremente `conselho`/`nroConselho`/`especialidades` sem allowlist de campo. Esses campos são o snapshot legal congelado em receitas/atestados (`documento-actions.ts:114-116,152-153`). Não há workflow de aprovação de credencial (grep `aprov|verificad` vazio). Runtime: logado como `dr.joao@familiaponcio.org.br`, campos `conselho` (CRM-RJ) e `nroConselho` (12345) habilitados com "Salvar alterações".
- **Severidade:** MÉDIA (afeta só documentos futuros; escopo = próprio registro; gera `profissional_atualizado` no audit).
- **Fix:** No branch `ehProprio`, allowlist só `nomeExibicao`/`bio`; `conselho`/`nroConselho`/`especialidades` exigem `podeGerenciarProfissional`.

#### M4 · medico · rbac · criarProfissionalAction confia no userId postado
- **Onde:** `src/app/medico/profissionais/actions.ts:19-53`; contraste com `novo/page.tsx:19-27` e o irmão `capacitacao/actions.ts:415-450` (`vincularLoginInstrutorAction`).
- **Evidência:** A action só checa permissão do chamador, pega `userId` cru do FormData e cria `Profissional` sem revalidar que o User-alvo tem papel `profissional@medico` nem que ainda não tem `Profissional`. O filtro de elegibilidade só existe na página (gate de UI). O irmão de capacitação faz exatamente as 2 checagens ausentes (prova de intenção). Mitigantes: `userId @unique` (POST duplicado vira 500, não corrupção silenciosa); acesso clínico é gateado pelo papel, não pela linha `Profissional` → não concede capability nova.
- **Severidade:** MÉDIA (defeito de boundary em server action; sem escalada de outsider).
- **Fix:** Na action, revalidar papel do alvo (`temPapel('profissional','medico')`) e vínculo único antes do `create`, com erros amigáveis.

#### M5 · cidadaos · perf/bug · Paginação por cursor instável (orderBy nome, cursor id)
- **Onde:** `src/lib/cidadao.ts:121-128` (orderBy `nomeCompleto asc`, cursor `{id}`).
- **Evidência:** Cursor do Prisma exige que o `orderBy` inclua o campo do cursor como tiebreaker; com ordenação só por nome (não-único, `schema.prisma:200` sem @unique) e cursor por id, homônimos podem ser pulados/duplicados entre páginas. (A perda de filtros do mesmo link está em **M1**.)
- **Severidade:** MÉDIA (impacto restrito a colisões de nome idêntico).
- **Fix:** Adicionar `{ id: "asc" }` como segundo critério no `orderBy`.

#### M6 · capacitacao · rbac · Instrutor não transiciona matrícula das próprias turmas (branch morto)
- **Onde:** `src/app/capacitacao/actions.ts:156` (chama com 3 args); `src/lib/capacitacao/rbac.ts:40-61` (`podeTransicionarMatricula`, 4º param `matriculaInstrutorUserId`).
- **Evidência:** A action chama `rbacPodeTransicionarMatricula(session, status, para)` sem o 4º arg; a única via que libera `profissional` exige `matriculaInstrutorUserId === session.user.id`, que nunca é passado → sempre `false`. Agravante UX: `turmas/[id]/page.tsx:294-329` renderiza os botões sem gate por `podeTransicionarMatricula` → instrutor vê os botões e o clique lança "Sem permissão". Teste `capacitacao-rbac.test.ts:79-95` não cobre o caminho `profissional`.
- **Severidade:** MÉDIA (capability morta, fail-closed; bloqueia trabalho do instrutor, não é brecha).
- **Fix:** Passar `m.turma.instrutor.userId` como 4º arg na action e gatear os botões por `podeTransicionarMatricula`.

#### M7 · capacitacao · rbac · Predicados `pode*` checam só o nome do papel (ignoram unitScope)
- **Onde:** `src/lib/capacitacao/rbac.ts:11-90` vs `src/lib/rbac.ts:38-41` (`hasAnyRole`).
- **Evidência:** Todos os `pode*` delegam a `hasAnyRole` (só `r.name`), nunca `r.unitScope`. Isolado, `podeGerenciarCurso` retorna `true` para um gestor de OUTRA unidade. Hoje tapado por defesa em profundidade: middleware (`proxy.ts:78-86`) + todas as 13 actions começam com `canAccessUnidade('capacitacao')` antes do `pode*`. Footgun: qualquer futuro uso de `pode*` sem o gate na frente abre escrita cross-tenant. QA do projeto (`docs/qa/2026-06-06-qa-report.md:53`) já sinalizou o padrão.
- **Severidade:** MÉDIA (fragilidade latente, sem exploit atual).
- **Fix:** Tornar os `pode*` self-protecting passando `unitScope`/area (`hasAnyRole + canAccessUnit`).

#### M8 · medico · dados · Altura migrada em metros vira `alturaCm` absurdo (1.68 m → "2 cm")
- **Onde:** `src/lib/migracao-amplimed/consulta.ts:35-39,61` (`intSeguro`); `src/app/medico/consultas/[id]/page.tsx:50,164`.
- **Evidência:** `Math.round(1.68)=2` passa o guard (`2<100000`); grava `alturaCm=2` em `notaEvolucao` com `status:assinada` (imutável). `calcularImc` retorna `null` (guard 30-250cm protege só o IMC derivado), mas o vital "2 cm" persiste e é renderizado read-only. `validarSinaisVitais` (que pegaria isso) não tem nenhum caller. Falha vale para qualquer altura <100.
- **Severidade:** MÉDIA (dado clínico errado em registro imutável; mitigado por absurdo óbvio + IMC neutralizado).
- **Fix:** Normalizar altura no mapper da migração (detectar valor <3 como metros → ×100) e conectar `validarSinaisVitais` à UI como aviso.

#### M9 · capacitacao · rbac/lgpd · Verificação pública de certificado expõe nome sem noindex/rate-limit
- **Onde (dedup: medium + low):** `src/app/verificar/[codigo]/page.tsx:28`; `src/app/verificar/[codigo]/pdf/route.tsx:14`. Código = `IFP-<16 hex>` (`actions.ts:382`).
- **Evidência:** Rotas públicas (fora do matcher) retornam `nomeAluno` (= nomeSocial ?? nomeCompleto) + curso + carga + % frequência. Código de 64 bits inviabiliza enumeração (mitigante forte → o sub-ponto "rate-limit" é de baixo valor). Risco residual: PII em claro + ausência de `noindex`/`X-Robots-Tag` (sem `robots.ts`/`generateMetadata`) → um QR-target vazado pode ser indexado e tornar nome+frequência pesquisáveis/permanentes. Sem CPF no model `Certificado` (reduz severidade).
- **Severidade:** MÉDIA (no limite inferior — hardening LGPD, não bypass de acesso).
- **Fix:** Adicionar `X-Robots-Tag: noindex` / `robots` na rota `/verificar`; opcional rate-limit leve.

#### M10 · hub · bug · Saudação com fallback hardcoded "Erick"
- **Onde:** `src/app/inicio/page.tsx:119`.
- **Evidência:** `const firstName = session.user.name?.split(" ")[0] ?? "Erick";` renderizado no `<h1>`. `User.name` é nullable (`schema.prisma:16`) e não há coalesce no callback de sessão. `/inicio` é destino só de super_admin/presidencia → exatamente esses papéis veem "Bom dia, Erick." se `name` for null. Nome do dev (`seed.ts:589`) vazado para produção.
- **Severidade:** MÉDIA (não é RBAC/crash; depende de papel global com name null, incomum sob seed).
- **Fix:** Trocar o fallback por algo neutro (ex.: "bem-vindo(a)" sem nome, ou e-mail).

#### M11 · hub · falta/ux · Sem error boundary fora de /medico (500 cai em tela técnica em inglês)
- **Onde (dedup: estático + runtime c/ screenshot):** `src/app/medico/error.tsx` (único); ausentes em `/capacitacao`, `/app`, `/social`, `/poncio`, `/inicio`, `/admin`; sem `global-error.tsx`.
- **Evidência:** `find` confirma só `medico/error.tsx`; nenhum `global-error.tsx`. ~37 `throw` de server action fora de /medico (ex.: `anonimizar-actions.ts:19`, 26 em `capacitacao/actions.ts`). Runtime: o 500 da transição de matrícula renderizou "This page couldn't load / A server error occurred" + "ERROR 2286198182" em inglês. Screenshot: `overnight-AUDIT/capacitacao-instrutor-transicao-500.png`. Refinamento: pages usam `notFound()` → `not-found.tsx` (amigável); o gap real são os `throw` de **server action** no submit. Digest é hash opaco (não vaza stack/PII).
- **Severidade:** MÉDIA (UX/consistência fora da marca; não é crash de dados nem info-leak).
- **Fix:** Adicionar `error.tsx` pt-BR por vertical (ou um `global-error.tsx` global), reaproveitando o de /medico.

#### M12 · cidadaos · a11y · Form de Ficha Cidadã: campo inválido sem aria-invalid/aria-describedby
- **Onde (dedup: estático + runtime):** `src/app/app/cidadaos/novo/form.tsx:643-683` (Input local).
- **Evidência:** Input local aplica só classe `is-error`; `<p class=field-error>` sem `role=alert`/`id`; input sem `aria-invalid`/`aria-describedby`. Grep no diretório de cidadãos: zero atributos de anúncio. O componente compartilhado `src/components/ui/input.tsx:31,35` faz certo (regressão do próprio padrão). Runtime confirmou `aria-invalid=null`, `role=null`. Falha WCAG 3.3.1 / 4.1.3. Mitigação parcial: banner global + troca para a aba do 1º erro (para usuário vidente). Screenshot: `overnight-AUDIT/cidadao-novo-erro-validacao-a11y.png`.
- **Severidade:** MÉDIA (form interno de staff; fix simples e de baixo risco).
- **Fix:** Trocar Input/Textarea/Select locais pelo `@/components/ui/input` compartilhado (ou adicionar `aria-invalid` + `aria-describedby` + `role=alert`).

#### M13 · painel · rbac/dados · chamarAction confia 100% em nomeChamado/destino do cliente
- **Onde:** `src/app/painel/chamar-actions.ts:27-41`.
- **Evidência:** A action lê `nomeChamado`/`destino`/`cidadaoId` do FormData (hidden inputs) e só valida unidade+papel (`podeChamar`). O servidor nunca deriva o nome do `cidadaoId` — ele é gravado verbatim em `Chamada` e EXIBIDO + FALADO (TTS) na TV (`painel-tv.tsx:131,231`). Quem pode chamar (equipe clínica confiável) pode spoofar nome/destino arbitrário. `cidadaoId` só vira `rootEntityId` no audit. Nuance: não é "qualquer usuário" (exige auth + `podeChamar`); impacto é integridade/spoofing do display + auditoria fraca, não PII para outsider.
- **Severidade:** ~~baixa~~ → registrado como integridade. (verdict do auditor: baixa) — **BAIXA** (mantida; sem escalonamento de privilégio).
- **Fix:** Quando vier `cidadaoId`, derivar `nomeChamado` no servidor via `nomeChamado(cidadao)` em vez de confiar no hidden input; validar `destino` contra a unidade.

> *(M13 foi rebaixado a baixa no verdict; mantido aqui pela natureza rbac/dados, mas ranqueado como baixa — ver lista BAIXA abaixo.)*

### BAIXA (bugs/dados/rbac confirmados, baixo impacto)

| # | Área | Título | Onde | Fix em 1 linha |
|---|---|---|---|---|
| B1 | painel | chamarAction confia em nomeChamado/destino do cliente (spoof TV/TTS) | `painel/chamar-actions.ts:27-41` | Derivar nome do `cidadaoId` no servidor; validar destino. |
| B2 | painel | Chamadas nunca expiram; snapshot de nome persiste e escapa à anonimização LGPD | `lib/painel/chamada.ts:38-50`; `anonimizar-actions.ts:35-48` | Incluir tabela `Chamada` na anonimização + janela de retenção (ex.: take com filtro de data). |
| B3 | acesso | Usuário logado sem `primaryRole` cai em form de login (beco autenticado) | `inicio/page.tsx:90-91`; `rbac.ts:163-167`; `(auth)/login/page.tsx` | Garantir invariante `userRoles ⇒ primaryRoleName != null`; `/login` redireciona quem já tem sessão. |
| B4 | capacitacao | `transicionarTurmaAction` → 'concluida' sem avisar matrículas em 'cursando' | `capacitacao/actions.ts:238-264`; `turma.ts:7-13` | Ao concluir turma, contar/avisar matrículas ainda 'cursando' (não bloquear). |
| B5 | medico | Suspeita de fuso na agenda (write-UTC / read-local) — latente, mascarado pelo deploy UTC | `agenda/core.ts:39-71` vs `agenda/page.tsx:262-264`, `agenda-dia.ts:19-25` | Padronizar leitura/escrita em UTC (ou TZ explícito SP, como `hub-inicio.ts`). |
| B6 | cidadaos | `tipoSanguineo` migrado texto-livre vs enum Zod estrito → save trava p/ papel clínico | `migracao-amplimed/cidadao.ts:49` vs `cidadao-schema.ts:117` | Normalizar tipoSanguineo no mapper (sinônimos→enum; senão null + flag `problemas`). |
| B7 | medico | `logEvent` com cast `as never` desliga checagem de tipo de AuditAction | `consultas/[id]/actions.ts:12-17,37-39` | Tipar `ACTION_MAP` como `Record<…, AuditAction>` e remover o `as never`. |
| B8 | medico | `avaliarRiscoEvasao`/frequência da turma achata presenças de várias matrículas | `turmas/[id]/page.tsx:108-115` | Calcular frequência da turma como média das %/aluno, não soma de linhas. |
| B9 | capacitacao | `normalizeTelefone` assume DDD 21 fixo p/ números sem DDD | `import-alunos.ts:56-61` | Marcar `problemas` quando inferir DDD em vez de assumir RJ silenciosamente. |
| B10 | cidadaos | Filtro de unidade é select single mas código trata como CSV (`split(',')`) | `cidadaos/page.tsx:56-58` vs `:128-137` | Sincronizar `defaultValue` do select com o valor único real; ou suportar multi de fato. |
| B11 | medico | Open-redirect via campo `voltar` do FormData no check-in | `consultas/[id]/checkin-action.ts:18,36,53` | Aceitar só paths que começam com `/` e não `//`. |
| B12 | medico | Falha transitória de DB na tabela CID-10 afrouxa validação anti-forja | `prontuario-actions.ts:96-99` | Distinguir "tabela vazia" de "erro de query"; em erro, não aceitar código forjado. |
| B13 | outro | Landing: 404 `/.image-slots.state.json` (resíduo do editor) + link "Acesso ao Sistema" morto (`href=#`) | `src/app/page.tsx` | Remover fetch do state do editor em prod; apontar o link para `/acesso`. |
| B14 | acesso | Login revela existência de conta via `signin_denied_unit` (mensagem distinta) | `[unidade]/login/login-action.ts:51-85` | Unificar mensagem de erro (genérica) entre senha errada e unidade negada. |

---

## 🟡 O QUE FALTA
*(incompleto / ausente / não-ligado — ranqueado por severidade, depois por ROI)*

### MÉDIA

#### F1 · medico · falta · Edição de saúde no prontuário (§0.7) nunca foi ligada (dead code)
- **Onde:** `src/lib/medico/rbac.ts:101` (`podeAtualizarSaudeCidadao`, código morto); audit action `cidadao_saude_atualizada` em `audit.ts:56` (sem caller); `consultas/[id]/page.tsx` (saúde só leitura).
- **Evidência:** `podeAtualizarSaudeCidadao` só aparece na definição + teste; nenhuma page/action invoca. `cidadao_saude_atualizada` sem caller. Card "Saúde do paciente" é read-only (chips estáticos). Spec/plan F1B2 (plan:345, §0.7, spec:274) exigia edição inline dos 4 campos clínicos. Ressalva: os campos SÃO editáveis pelo cadastro geral (`/app/cidadaos/[id]/editar`), gate `podeEditarSaudeCidadao` vivo.
- **Severidade:** MÉDIA (feature documentada não-ligada + dead code; não impede atualizar saúde em absoluto).
- **Fix:** Implementar `atualizarSaudeCidadaoAction` (emitindo `cidadao_saude_atualizada`) com form inline no prontuário, ou remover o dead code se a feature foi descartada.

### BAIXA (faltas/incompletos confirmados)

| # | Área | Título | Onde | Fix em 1 linha |
|---|---|---|---|---|
| F2 | capacitacao | Promoção da lista de espera 100% manual — não dispara ao liberar vaga | `matricula.ts:139-166`; `aplicarTransicaoMatricula:115-129` | Ao mover ocupante p/ cancelado/desistente/reprovado, chamar `promoverDaListaEspera` (ou ao menos nudge "há N na espera"). |
| F3 | capacitacao | Remover quem ocupa vaga não reabre a fila nem avisa o operador | `turmas/[id]/page.tsx:356-365,294-329` | Mesmo fix de F2: nudge/auto-promoção na coluna de matriculados. |
| F4 | capacitacao | Importador de alunos legados (`import-alunos.ts`) é dry-run puro — sem action/tela | `import-alunos.ts:1-103` (sem consumidor) | Criar action+tela de carga (depende de base legal LGPD). |
| F5 | capacitacao | Certificado não tem revogação/anulação — código público fica "válido" para sempre | `capacitacao/actions.ts:357-408`; schema `Certificado` | Adicionar `revogarCertificadoAction` + estado `revogado` na verificação. |
| F6 | medico | `especialidadeIds` não validados (existência/ativa) → FK 500 ou vínculo inativo | `medico/profissionais/actions.ts:36-46,74-79` | Schema Zod + checar existência/`ativa` das especialidades antes do connect. |
| F7 | medico | `emitirAtestadoAction` sem validação → atestado vazio sem aviso (sem ramo `doc=erro_atestado`) | `documento-actions.ts:141-172`; `page.tsx:680` | Validar campos mínimos e adicionar ramo `doc=erro_atestado` na UI. |
| F8 | medico | Agenda semanal carrega TODOS os slots da semana sem teto e filtra 7 dias em memória | `medico/agenda/page.tsx:52-65,229-239` | Aplicar `take`/janela por dia no Prisma em vez de filtrar em JS. |
| F9 | medico | Página de consulta carrega PHI completa mesmo p/ quem não pode ver prontuário | `consultas/[id]/page.tsx:88-114` vs `:393` | Não incluir o bloco clínico no `findUnique` quando `!podeVerProntuario` (minimização LGPD). |
| F10 | cidadaos | Migração só preenche alergias; `medicamentosEmUso`/`condicoesCronicas` nunca mapeados | `migracao-amplimed/cidadao.ts:37-54` | Mapear os 2 campos clínicos restantes (se existiam na Amplimed). |
| F11 | cidadaos | `dataNascimento` aceita datas futuras / idades absurdas (sem refine de faixa) | `cidadao-schema.ts:72-76`; `calcularIdade` `cidadao.ts:341-350` | Adicionar `.refine` de faixa plausível (0–130 anos, não futura). |
| F12 | cidadaos | Triagem não chama `assertAcessoCidadao` (exceção ao hardening IDOR) | `cidadaos/[id]/triagem-actions.ts:16-176` | Adicionar `assertAcessoCidadao` por consistência (latente até papel com escopo de unidade). |
| F13 | cidadaos | Anexos gravados com `hashSha256` vazio — integridade não verificável (LGPD) | `anexo-actions.ts:137` | Computar SHA-256 do conteúdo no upload (remover o `// MVP`). |
| F14 | cidadaos | Busca de CEP falha em silêncio (sem feedback de erro) | `cidadaos/novo/form.tsx:134-152`; `cep.ts:64-66` | Mostrar aviso "CEP não encontrado, preencha manualmente" no else. |
| F15 | painel | `salvarVideoAction` não valida URL do YouTube — quebra silenciosa do player | `painel/[unidade]/config/painel-config-actions.ts:16-26` | Validar URL (regex YouTube) no save + feedback de erro. |
| F16 | painel | Painel/config aceita slugs `poncio`/`social` que não têm fila — telas vazias | `painel/[unidade]/page.tsx:13-30`; `config/page.tsx:20-30` | Restringir painel às 4 unidades operacionais. |
| F17 | hub | Presidência aterrissa em `/inicio`, nunca na casa temática `/poncio` | `rbac-types.ts:61-64`; `poncio/page.tsx` | Decidir a home canônica da presidência (apontar landing p/ `/poncio` ou aposentar `/poncio`). |
| F18 | hub | Falta tela `/admin/audit` (gate pronto, rota inexistente — 404 pós-gate) | `inicio/page.tsx:244-248`; `proxy.ts:38-43` | Implementar a page `/admin/audit` (feed completo de auditLog). |
| F19 | hub | Nenhum `loading.tsx` no app — sem estado de carregamento entre navegações | `src/app/**` | Adicionar `loading.tsx` (skeleton) nos segmentos pesados. |
| F20 | hub | Nav de `/inicio`: presidência não vê nav nem card de triagem | `app-shell.tsx:33-47`; `inicio/page.tsx:180,217` | Confirmar com a diretoria a experiência desejada da presidência. |
| F21 | acesso | `/login` e `/acesso` não redirecionam quem já está autenticado | `(auth)/login/page.tsx`; `acesso/page.tsx` | Chamar `auth()` e redirecionar logados para o landing por papel. |
| F22 | acesso | Campo hidden `unidade` no login genérico é ignorado — `/acesso` não leva ao salão escolhido | `login-form.tsx:143-145`; `login/actions.ts:28-32` | `signInAction` ler `formData.get("unidade")` e resolver `redirectTo` por slug. |
| F23 | acesso | Login super_admin demo não funciona (`erick.ramos@…` / `ifp-demo-2026` → inválido) | `/login`; seed | Corrigir/documentar credencial seedada de super_admin para auditoria via UI. |
| F24 | acesso | Tela de logout é a default do NextAuth em inglês | `/api/auth/signout` | Customizar a página de signout (pt-BR + estilo IFP). |
| F25 | hub | Landing pública: "O cuidado em números" mostra 0/0/0 (placeholders "a confirmar") | `/` (#impacto); `src/app/page.tsx` | Preencher números reais ou ocultar a seção até confirmar. Screenshot: `overnight-AUDIT/landing-numeros-zero.png`. |
| F26 | cidadaos | Busca de candidatos da Capacitação expõe nome de QUALQUER cidadão (cross-unit por design) | `capacitacao/actions.ts:271-301`; `medico/recepcao/page.tsx:36-44` | Confirmar se a busca deve escopar por unidade ou se cross-unit é intencional. |
| F27 | cidadaos | Badge de unidade: branco fixo sobre `var(--u-*)` sem garantia de contraste; ficha usa token divergente | `cidadaos/page.tsx:21-26,209-218` vs `[id]/page.tsx:128-131` | Unificar token de cor da unidade + garantir contraste AA. |

---

## COBERTURA — honestidade sobre o que foi e não foi testado

### ✅ Coberto
- **Análise estática (leitura de código real):** RBAC (`src/lib/**/rbac.ts`, `cidadao-authz.ts`), todas as server actions de medico/capacitacao/cidadaos/painel/acesso, schema Prisma, mappers de migração Amplimed, PDFs de receita/atestado, proxy/middleware. Cada achado alta/média foi **verificado adversarialmente** (tentativa de refutação) — vide campo `verdict` na fonte.
- **Runtime por papel na staging** (`https://ifp-app.taile04c66.ts.net`): login como `profissional@medico` (dr.joao), gestor; navegação `/medico/agenda`, `/medico/minha-agenda`, `/medico/profissionais/[id]`, `/app/cidadaos` (lista + paginação + filtros), `/app/cidadaos/novo` (validação + a11y via DOM inspection), transição de matrícula de instrutor (capturou o 500 sem error boundary). Screenshots em `C:/Users/Administrador/ifp-connect/overnight-AUDIT/`.

### ❌ NÃO coberto / lacunas de cobertura
- **Achados BAIXOS não foram re-verificados em runtime** — vieram só de leitura estática (40 itens). Confiança menor que os alta/média.
- **`/admin/users` e `/admin/audit` via UI:** não auditados — o login super_admin demo falhou (F23) e `/admin/audit` não existe (F18).
- **Suite e2e não foi executada.** Não há `loading.tsx`/error boundary cross-vertical testados sob carga.
- **Fuso horário (B5/M8-altura):** confirmados no código mas o **comportamento de fuso só foi observado mascarado** (servidor UTC) — não foi testado um deploy em BRT, que é onde o bug latente apareceria.
- **Verificação pública de certificado:** rota inspecionada estaticamente; não foi feito teste de carga/indexação real (robots).
- **Painel/TV (`/painel/[unidade]`):** auth/canAccessUnidade confirmados no código; o fluxo TTS e o display público não foram observados em runtime com chamadas reais.
- **Migração Amplimed:** mappers lidos; **a carga real contra a base de produção não foi executada nem validada com dados reais** (volume, dados sujos além dos exemplos).
- **Telas que exigiam setup complexo** (seed de cenários específicos: lista de espera lotada, turma com entradas/saídas, certificado emitido por erro) foram analisadas só por código.

---

**Arquivo:** `C:/Users/Administrador/ifp-connect/docs/superpowers/reports/2026-06-14-auditoria-geral.md`
