# Auditoria IFP Connect — 2026-06-25

## Resumo executivo

O **núcleo de produto está pronto para go-live** (~88% do GAP), com toda a suíte
E2E ao vivo verde por vertical (médico, capacitação, esportivo, educacional,
serviço social, presidência, admin/auth) e segurança multi-tenant validada no
código **e** ao vivo (parede de tenant 7/7, IDOR de família, portão de perfil).
O que trava o go-live **não é o código de produto e sim a cadeia de deploy e os
gates externos**: o `seed` de desenvolvimento (famílias fictícias) é injetado no
passo de `migrate` de **produção**, e o compose de produção **não passa as
variáveis MINIO_*** para a API — quebrando, em prod, as features de storage
(documentos da ficha e fotos do diário) que já estão vivas no código.

**Contagem de achados (após verificação adversarial):**

- **P0 verificados: 3** — (1) seed dev no migrate de prod; (2) storage sem
  `MINIO_*` no compose de prod com features de storage já vivas; (3) trilha de
  auditoria LGPD `fire-and-forget` que pode perder o registro silenciosamente.
- **P1 verificados: 9** (consolidados de ~16 leads — vários eram o **mesmo**
  achado relatado por agentes diferentes, ex.: `$queryRawUnsafe`, MIME por
  Content-Type, throttle de verificação pública, IDOR esportivo, `noreferrer`).
- **P2 verificados: 13** (também consolidados; ex.: o `noreferrer` foi relatado
  por 4 agentes como 1 achado real).
- **Suspeitos / a confirmar: 2** (ver §2.4) — exigem checagem na VM ou decisão.
- **Falsos-positivos descartados: 2** — (a) "floating promise em `auditarLeitura`"
  (o lead se contradiz: o autor admite que o padrão `void` é **correto** e o real
  achado é duplicação de query, já contabilizado como P2); (b) "valida-mensagens
  1/29 falha = leak de produção" (verificado: é colisão de fixture no seed, o
  serviço está **correto** — vira P2 de teste, não de produto).

> Observação de método: muitos "achados" chegaram duplicados porque 6 agentes
> revisaram o mesmo código. Consolidei por **achado real**, não por relato. Cada
> P0/P1 abaixo foi reaberto e confirmado no arquivo (arquivo:linha real).

---

## Status Baseline (Fase 0)

| Gate | Resultado |
|---|---|
| **typecheck** | 5/5 VERDE |
| **lint** | VERDE — só warnings (vários `@next/next/no-img-element` no `(site)`, 1 `react-hooks/exhaustive-deps`, 1 pré-existente em familia/crianca); **zero erros** |
| **build web** | COMPILA 67/67; passo `standalone` falha por EPERM de symlink **no Windows** (ambiente — passa no Linux) |
| **typecheck api** | VERDE |
| **validas (E2E ao vivo)** já verdes na sessão | triagem 14/14, admin-config 30/30, presidencia-saude 29/29, storage 6/6, documentos-ficha 24/24, edu-fotos 32/32, notificacoes 43/43, familia 87/87 |

---

## 1. Funciona? — fluxos OK / quebrados / frágeis

### 1.1 OK (E2E ao vivo verde, com evidência)

A suíte `scripts/valida-*.mjs` foi rodada inteira contra a API local
(`127.0.0.1:3333`), reiniciando a API entre lotes para zerar o rate-limit de
login. **Tudo verde por vertical:**

- **Médico** — agenda 12/12, prescrição 16/16, atestado 30/30, odonto 22/22,
  triagem 18/18, recepção 22/22, beneficiários/ficha clínica 17/17.
- **Capacitação** — cursos 83/83, matrículas+certificados 31/31, banco-modelos 36/36.
- **Esportivo** — 99/99.
- **Educacional** — vertical (todos ✓) + gestão 18/18.
- **Serviço Social** — encaminhamentos 21/21, ponte 15/15, idempotência 11/11,
  agenda transversal 20/20, ficha 32/32.
- **Presidência/Sala de Comando** — 54/54, impacto longitudinal 20/20, relatórios
  selados 28/28.
- **Admin/Auth** — usuários 65/65, governança/auditoria 49/49,
  auto-provisionamento 33/33.
- **Segurança transversal** — parede de tenant 7/7 (acesso cruzado = 403),
  consentimento de menor 7/7, fichas-cidadãs 15/15, verificação pública 14/14.

### 1.2 Frágeis / sem cobertura (natureza de teste, NÃO quebra de produto)

| Item | Severidade | Evidência | Natureza |
|---|---|---|---|
| `valida-mensagens` 28/29 — caso "criança de outra unidade → 404" recebe 201 | P2 | `scripts/valida-mensagens.mjs:156` × `packages/database/prisma/seed.ts:1007-1021` × `apps/api/src/educacional/conversas.service.ts:56-72` | **Colisão de fixture no seed**: o id `seed-membro-fora-unidade` foi rematriculado na MESMA unidade para servir a outro teste IDOR. O serviço está **correto** (encontra matrícula ativa → cria conversa). Não é leak. |
| `valida-medico-equipe` (Bloco G) não roda | P2 | `scripts/valida-medico-equipe.mjs:48` | Script loga `admin@ifp.local` com a senha do médico, sem fallback p/ `SENHA_ADMIN` → 401 e aborta. O controller/serviço de equipe **existem** (`apps/api/src/medico/equipe.controller.ts`). Fluxo fica **sem cobertura E2E**, não quebrado. |
| Helper `ifp-ci.ps1` não propaga `SENHA_ADMIN` ao node no branch `valida` | P2 | `scripts/ifp-ci.ps1:45` | Mascara como "quebrado" todo script que loga admin (presidencia-impacto, admin, admin-provisionamento). Provado ambiente: rodando `node` direto com env explícito passa 20/20. **Defeito de harness, não de produto.** |

**Nenhum fluxo crítico está quebrado.** Os 3 itens acima são dívida de teste/CI.

---

## 2. Qualidade & Segurança — achados verificados por severidade

### 2.1 P0 (travam go-live / risco a dado clínico ou LGPD)

#### P0.1 — Seed de desenvolvimento (famílias fictícias) injetado no `migrate` de PRODUÇÃO
- **Esforço:** M · **Status:** verificado
- **Evidência:** `docker-compose.tailscale.yml:20-25` (adiciona `SEED_SUPER_ADMIN_*` e
  `SEED_MEDICO_PASSWORD` ao service `migrate`, com o comentário "O seed precisa
  enxergar as senhas de seed") × `packages/database/prisma/seed.ts:58-107` (cria
  CPFs inválidos repetidos `111…`/`222…`/`333…`/`444…`, contas `@ifp.local`,
  triagens, prontuários, alergias "Dipirona/Amendoim GRAVE" e fixtures de IDOR
  "Caio da Silva").
- **Por que P0:** roda o seed em prod, contamina a base real com dados de teste
  indistinguíveis dos reais e cria contas com senha conhecida de seed. Em sistema
  com dado clínico/LGPD é contaminação de base + contas previsíveis.
- **Correção sugerida:** o target `migrate` já roda só `prisma migrate deploy`
  (`apps/api/Dockerfile`, target `migrator`). **Remover as envs `SEED_*` do override
  de prod.** Se precisar de Super Admin inicial em prod, criar um seed mínimo
  SEPARADO (só o admin, gated por `NODE_ENV`). Se o seed dev já entrou na
  `ifp-final`, limpar os registros de fixture (CPFs `111…`/… e e-mails `*@ifp.local`).

#### P0.2 — Compose de produção não passa `MINIO_*` à API, mas o storage (Onda C) já está vivo
- **Esforço:** M · **Status:** verificado
- **Evidência:** `docker-compose.prod.yml:70-77` (service `api` com apenas
  `WEB_ORIGIN`/`DATABASE_URL`/`REDIS_URL`/`JWT_*` — **sem nenhuma `MINIO_*`**, e
  não há service `minio` no compose) × `apps/api/src/storage/storage.service.ts:30-31`
  (`accessKey`/`secretKey` com default `""`; `onModuleInit` em try/catch nas
  linhas 44-58 **não derruba o boot**).
- **Por que P0:** o boot sobe "ok" mas TODA rota de upload/download de documento da
  ficha e foto do diário falha em runtime. Features já mergeadas (C2/C3) ficam
  quebradas em prod sem ninguém perceber no boot.
- **Correção sugerida:** adicionar service `minio` (ou S3/R2 gerenciado) ao
  `docker-compose.prod.yml` e injetar `MINIO_ENDPOINT/PORT/USE_SSL/ACCESS_KEY/SECRET_KEY/BUCKET`
  no `environment` do service `api` (em prod `MINIO_USE_SSL=true`). Validar em
  `/admin/storage/health` após deploy.

#### P0.3 — Trilha de auditoria LGPD é `fire-and-forget` e pode falhar silenciosamente
- **Esforço:** G · **Status:** verificado
- **Evidência:** `apps/api/src/audit/audit.service.ts:26-40` — `registrar()` é `void`,
  dispara `prisma.auditLog.create(...)` sem `await` e o único tratamento é
  `.catch((err) => this.logger.error(...))`. 159 call-sites em 47 arquivos.
- **Por que P0:** para operações com obrigação LGPD explícita (emissão de
  prescrição com override de alergia, download de documento de família, leitura de
  ficha clínica, geração de PDF de prontuário), a operação pode concluir com
  sucesso e a trilha falhar sem nenhum sinal — numa auditoria regulatória o log
  diria "nenhum acesso registrado" para dados efetivamente acessados.
- **Correção sugerida:** mínimo imediato — métrica/contador de falha + alerta
  operacional (não pode ser puramente silencioso). Médio prazo — padrão **outbox**:
  gravar o evento na MESMA transação Prisma da operação principal e processar
  assíncrono, garantindo a trilha transacionalmente.

> Nota sobre o lead "P0 PDF stream / outros P0": os demais relatos de P0 (PDF sem
> handler de `error`, upload órfão) foram **rebaixados a P1** na consolidação por
> serem contornáveis e não tocarem em perda de dado clínico/LGPD diretamente. O
> único P0 de auditoria que sobrou é o registro silencioso acima.

### 2.2 P1 (sérios, corrigir antes da abertura pública)

| # | Achado | Esforço | Arquivo:linha | Correção | Status |
|---|---|---|---|---|---|
| P1.1 | **IDOR esportivo**: `matricular` grava `membroId` sem validar que pertence ao `fichaId` (vínculo de dado de menor entre famílias) | P | `apps/api/src/esportivo/turmas-esportivas.service.ts:598-603` (grava em :603; falta a checagem que existe em `educacional/turmas-infantis.service.ts:117-118` e `capacitacao/turmas.service.ts:344`) | Antes do `create`, `tx.membroFamiliar.findFirst({ where: { id: dto.membroId, fichaId: dto.fichaId } })` → 404 se não pertencer. Esportivo é o único dos 3 sem a checagem. | verificado (li os 3 services + schema sem FK composta) |
| P1.2 | **`$queryRawUnsafe` com interpolação de identificadores** (`tabela`/`coluna`/`whereExtra`) em `serieMensal` — SQLi latente se reusado com input externo | P | `apps/api/src/presidencia/presidencia.service.ts:597-616` (where extra concatenado como `AND t.${...}` em :603) | Allowlist explícita de tabelas/colunas + `Prisma.raw()` para identificadores e `Prisma.sql` para valores (padrão de `turmas.service.ts`). Trocar `whereExtra: string` por flag booleana. | verificado (li o método; hoje só literais internos) |
| P1.3 | **Upload órfão**: `putObject` (MinIO) antes do `prisma.create`; se o INSERT falhar, o arquivo (documento da ficha / foto de menor) fica órfão sem rollback | M | `apps/api/src/fichas-cidadas/documentos.service.ts:93-107` e `apps/api/src/educacional/fotos-diario.service.ts:133-146` | try/catch: se o `create` lançar, `storage.removeObject(objectName).catch(()=>undefined)` antes de relançar. Ou gravar linha "pendente" antes do upload. | verificado (li os 2 serviços) |
| P1.4 | **MIME por Content-Type do cliente** (sem magic bytes) — HTML/exec disfarçado de JPEG passa; risco de XSS via presigned URL | M | `apps/api/src/fichas-cidadas/documentos.service.ts:86` e `apps/api/src/educacional/fotos-diario.service.ts:104` | `file-type` (`fileTypeFromBuffer`) — checar `detected.mime`, não `arquivo.mimetype`. Considerar `Content-Disposition: attachment` no presigned. | verificado |
| P1.5 | **Endpoints públicos de verificação sem throttle dedicado** — só sob o teto global 120/min; expõem nome do paciente/aluno e tipo de documento médico (atestado/receita) sem auth | P | `apps/api/src/medico/verificacao-documento.controller.ts:91-104`, `capacitacao/verificacao.controller.ts`, `esportivo/verificacao-graduacao.controller.ts` | `@Throttle` dedicado (ex.: 20/min; 5-10/min no documento médico). `codigoVerificacao` é cuid de alta entropia, mas 120/min é generoso p/ PII pública. | verificado |
| P1.6 | **`.env.production.example` incompleto** — faltam `MINIO_*` (storage Onda C), `SEED_*`, `RESEND`; quem montar prod a partir dele cai no P0.2 | P | `.env.production.example:1-27` | Sincronizar com TODAS as vars lidas em prod (`MINIO_*` com `USE_SSL=true`); documentar que `SEED_*` **não** deve existir em prod. | verificado |
| P1.7 | **Sem recuperação de senha self-service** — `RESEND_API_KEY` é código-morto (zero envio de e-mail/WhatsApp/push); única via é admin gerar senha provisória (gate Grupo C) | G | `apps/api/src/auth/auth.controller.ts:18-63`, `.env.example:25-26` | Decisão consciente: operar só com reset admin-driven (documentar) **ou** implementar reset por e-mail (Resend). Se ficar admin-driven, remover `RESEND_API_KEY` do exemplo. | verificado (grep `resend/smtp/forgot` = 0 envios) |
| P1.8 | **Observabilidade fraca** — sem exception filter global, sem logging estruturado, sem correlation-id; risco de PII em log de erro 500 | M | `apps/api/src/main.ts:9-12` (logger default, sem `APP_FILTER`); grep `ExceptionFilter/APP_FILTER/pino/winston` = 0 | `AllExceptionsFilter` global (`APP_FILTER`) que padroniza erro sem vazar PII + logger estruturado (`nestjs-pino`) com redação de campos sensíveis. | verificado |
| P1.9 | **Duas migrations de 24/06 pendentes na VM** (`admin_configuracao_plataforma`, `educacional_fotos_diario`) — código novo pode apontar p/ tabela inexistente → 500 | P | `packages/database/migrations/20260624000000_admin_configuracao_plataforma` e `20260624230000_educacional_fotos_diario` | No deploy: `--profile tools run --rm migrate` (rebuild da imagem `migrate`) ANTES de subir api/web; validar `prisma migrate status`. Gate de ordem de deploy. | verificado (ls migrations) |

> **CDSS / segurança clínica (P1 de capacidade, não de bug):** dois leads foram
> classificados como P1 de capacidade ausente e **não bloqueiam o núcleo**, mas
> exigem decisão consciente antes de escalar volume:
> - **Alergia casa só por NOME** (`apps/api/src/medico/alergia-check.ts:60-73`,
>   confirmado em `alergia-check.spec.ts:38`): "Penicilina" não casa "Amoxicilina".
>   É a barreira ÚNICA hoje. Mitigantes: médico vê todas as alergias na prancha,
>   checagem server-side, override auditado.
> - **Sem alerta automático de vital crítico na triagem** (sem NEWS2/qSOFA,
>   `apps/api/src/medico/triagem-enfermagem.service.ts:67-91`): vitais são só
>   registrados; o software não é rede de segurança para deterioração clínica.
>
> Recomendação: tratar como **roadmap clínico** com decisão do Erick + validação
> contra especificação publicada, não como bloqueio de go-live do núcleo.

### 2.3 P2 (melhorias / hardening) — verificados

1. **`/health` raso** — retorna `{status:'ok'}` estático, não checa DB/Redis/MinIO; o healthcheck do compose marca "healthy" mesmo com MinIO fora (cenário do P0.2). `apps/api/src/health.controller.ts:7-15`. → `@nestjs/terminus` com `/health` (liveness) e `/health/ready` (readiness). Esforço M.
2. **N+1 de transações** no `registrarRotinaLote` — uma `$transaction` por criança no loop (turma de 30 = 90 round-trips). `apps/api/src/educacional/rotina.service.ts:296`. → `createMany` + `SELECT … FOR UPDATE` em lote. Esforço M.
3. **N+1 em `ComunicadosEntregaService.listar`** — `publicoAlvo()` chama o banco 1×/comunicado. `apps/api/src/admin/comunicados-entrega.service.ts:72-89`. → `groupBy` em lote + Map. Esforço M.
4. **`impactoSeries`/`impacto`/`familias` rodam queries pesadas em série** (deveria ser `Promise.all`). `apps/api/src/presidencia/presidencia.service.ts:481-525, 554-560`. → paralelizar queries independentes. Esforço P-M.
5. **Site institucional usa `<img>` nativo** (12 tags, sem `next/image`/WebP/CLS reservado); `lion-white.png` referenciado 8× sem preload. `apps/web/app/(site)/_components/SiteInstitucional.tsx`. → `next/image` + `remotePatterns` + `<link rel=preload>`. Esforço M.
6. **Busca global `ILIKE '%termo%'` sem índice** em `nomeCompleto` (seq scan a cada keystroke). `apps/api/src/busca/busca.service.ts:65`. → índice GIN `pg_trgm`. Esforço M.
7. **`TIMESTAMP(3)` sem fuso** em colunas clínicas imutáveis e na trilha LGPD (`encerradoEm`, `emitidaEm`, `audit_logs.criadoEm`). `packages/database/schema.prisma:565`. → `@db.Timestamptz(3)` + migration. Esforço G.
8. **Ausência de RLS no Postgres** (reconhecida no próprio schema: comentário TODO). `packages/database/schema.prisma:1350`. Controle 100% na app. → RLS progressivo nas tabelas sensíveis. Esforço G.
9. **Índices faltantes em FKs** — `atendimentos.profissionalId`, `membros_familiares.fichaId`, `matriculas_infantis.(turmaId,ativa)`, `mensagens_familia.autorId`, `presenca(s).matriculaId`. `packages/database/schema.prisma`. → `@@index` + migration. Esforço P.
10. **`noreferrer` ausente** em 3 links externos do site (Instagram/YouTube usam só `noopener`). `apps/web/app/(site)/_components/SiteInstitucional.tsx:681-714`. → `rel="noopener noreferrer"`. Esforço P. *(relatado por 4 agentes — 1 achado real)*
11. **Acessibilidade do site/modal** — dots do hero como `<i onClick>` sem `role`/`tabIndex`/`aria-label`; modal "Palavra do Dia" sem trap de foco. `SiteInstitucional.tsx:402, 780`. → `<button>` + foco gerenciado. Esforço P-M.
12. **`eslint-disable exhaustive-deps` sem justificativa** em `OdontogramaBloco` (estado médico pode não rehidratar em re-fetch). `apps/web/components/medico/odontograma-bloco.tsx:59`. → `useRef` de primeira-carga ou incluir `data` na dep. Esforço P.
13. **Senha só `MinLength(8)`** sem complexidade, em sistema com dado clínico. `apps/api/src/auth/dto/trocar-senha.dto.ts:8`. Mitigado por throttle 10/min + bcrypt 12. → exigir 3 classes / 10-12 chars no `TrocarSenhaDto`. Esforço P.

**Outros P2 menores verificados** (mesma família, baixo impacto): `WEB_ORIGIN`
sem validação no boot → QR de PDF aponta p/ localhost se a env faltar
(`certificado-pdf.service.ts:55` etc.); `NEXT_PUBLIC_API_URL` default localhost no
compose prod sem o override tailscale (`apps/web/Dockerfile:23-24`); ausência de
timeout nos `fetch` do front (`apps/web/lib/use-auth-fetch.ts`); `removeObject` com
`.catch(()=>undefined)` em remoção de dado pessoal (`documentos.service.ts:177`);
`PrismaService.onModuleInit` sem try/catch contextualizado
(`apps/api/src/prisma/prisma.service.ts:8-10`); telas órfãs do rail (ver §3).

### 2.4 A confirmar (suspeitos — exigem VM ou decisão, não verificados localmente)

1. **JWT sem logout / blacklist** (token válido até 8h após comprometimento).
   `apps/api/src/auth/jwt.strategy.ts:26-39`. É P1 conceitual, mas o trade-off
   (stateless vs. Redis blacklist) e a janela de 8h são **decisão de produto** —
   marcado suspeito até o Erick definir o modelo de sessão.
2. **CASCADE DELETE alcança registro clínico** (DocumentoMedico/Prescricao/
   Atendimento têm `onDelete: Cascade` a partir de FichaCidada). `schema.prisma:1561-1562`.
   **Risco latente, não explorável hoje** (grep não achou nenhum `delete` de
   FichaCidada/Atendimento; remoção de membro é bloqueada com histórico). Confirmar
   intenção de retenção legal antes de trocar p/ `Restrict`/soft-delete.

### 2.5 Falsos-positivos descartados (2)

1. **"Floating promise em `auditarLeitura`"** — o próprio lead se contradiz: o autor
   afirma que o padrão `void` fire-and-forget do AuditService é **correto**, e o
   "bug" real descrito é duplicação de query em `saude()` — já contabilizado como
   P2.4. Não é achado de async.
2. **"`valida-mensagens` 1/29 = leak de produção"** — verificado: é colisão de
   fixture no seed; o `conversas.service.ts` está **correto** (cria 201 porque a
   criança foi de fato matriculada na unidade). Rebaixado a P2 de teste (§1.2).

---

## 3. Gaps de feature — backlog priorizado

### 3.1 Já no GAP-ATUAL (grupos A-E) — gates externos confirmados no código

| Grupo | Estado verificado | Evidência |
|---|---|---|
| **B — IA (Claude/Anthropic)** | **Inexistente no código** (grep `anthropic\|claude` em `apps/` = 0). As 5 features (resumo clínico, triagem assistida, resumo do dia da creche, histórias de impacto, áudio/TTS) não existem. | `apps/api/src` (grep 0) × `docs/GAP-ATUAL-2026-06-24.md:36-38` |
| **C — Envio (e-mail/WhatsApp/push)** | **Canal real inexistente**; "Central de Avisos" é 100% agregação in-app read-only. `RESEND_API_KEY` é código-morto. | `notificacoes.service.ts` (sem sender) × `.env.example:25-26` |
| **Click-path / telas órfãs** (núcleo, não trava) | Educacional mostra "Turmas"/"Crianças" como "Em breve" embora Turmas esteja **pronta** (P1 de UX); item de rail "Frequência" do esportivo aponta p/ rota inexistente; `ShellPublico` é dead code com 3 links quebrados; Médico sem item "Painel" no rail; `/educacional/mensagens` sem entrada no rail. | `educacional/layout.tsx:10`; `nav.ts:93`; `Shell.tsx:88`; `nav.ts:65, 83` |

### 3.2 Novo (veio da referência — não estava destacado no GAP)

- **CDSS por classe terapêutica** (alergia + interação fármaco-fármaco e
  fármaco-condição) — hoje só casa por nome (§2.2). Pré-requisito clínico antes de
  escalar prescrições.
- **Escore automático de triagem** (NEWS2/qSOFA + flag de vital crítico) — função
  pura testável, sem PHI.
- **Verificação pública com PII minimizada** (nome mascarado) — decisão de
  produto/jurídico no fluxo anti-fraude.

---

## 4. Próximos passos

### 4.a Acionável já (vira `/feature-dev`, sem decisão externa)

1. **P0.1** — remover `SEED_*` do `docker-compose.tailscale.yml`; criar seed mínimo
   de Super Admin gated por `NODE_ENV` (e limpar fixtures da `ifp-final` se já entraram).
2. **P0.2** — adicionar service `minio` + envs `MINIO_*` no `docker-compose.prod.yml`
   (api) e sincronizar `.env.production.example` (P1.6).
3. **P0.3** — métrica/alerta de falha de auditoria (mínimo) e desenhar outbox.
4. **P1.1** — validar `membroId`↔`fichaId` no `matricular` do esportivo (1 query, padrão já existe).
5. **P1.2** — allowlist + `Prisma.raw`/`Prisma.sql` em `serieMensal`.
6. **P1.3 / P1.4** — try/catch de rollback no upload + magic bytes (`file-type` já no lockfile).
7. **P1.5** — `@Throttle` dedicado nos 3 controllers públicos de verificação.
8. **P1.8** — `AllExceptionsFilter` global + logger estruturado com redação de PII.
9. **P1.9** — rodar as 2 migrations pendentes no deploy (gate de ordem).
10. Click-path (§3.1) — liberar Turmas no `ROTAS_PRONTAS` (criando page de índice),
    remover/criar a tela "Frequência", limpar `ShellPublico`.

### 4.b Precisa de DECISÃO do Erick (custo / infra / produto)

1. **Chave Anthropic + LGPD** — habilitar Grupo B exige chave, cliente isolado,
   gate de revisão humana e auditoria do dado sensível enviado. Decidir escopo e
   se entra **fora** do go-live inicial.
2. **SMTP/WhatsApp (Grupo C)** — decidir entre operar só com reset admin-driven
   (documentar) ou contratar Resend/WhatsApp gateway para reset/avisos reais.
3. **Fotos do site institucional** — hoje carregadas do `wixstatic.com`; decidir
   migrar para assets próprios + `next/image` (P2.5).
4. **Modelo de sessão/JWT** (§2.4.1) — stateless 8h vs. logout com blacklist Redis.
5. **Retenção legal de registro clínico** (§2.4.2) — trocar CASCADE por
   `Restrict`/soft-delete nas tabelas clínicas (requer migration).
6. **Deploy** — confirmar a ordem `migrate` antes de `api/web` na `ifp-final` e a
   limpeza do seed dev, já que o pipeline tem a pegadinha do `build api web` que
   não rebuilda a imagem `migrate`.

---

**NÃO implementar nada sem OK do Erick.**
