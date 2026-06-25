# 📐 RFC — Sweep completo do gap (fechar A→E com ralphinho)

> **Intake:** 2026-06-24. Decisão do Erick: *"atacar todos os grupos um a um com ralphinho-pipeline"*.
> Fonte do gap: `docs/GAP-ATUAL-2026-06-24.md` (núcleo interno ~88%; Site Público ~28%).
> Branch: `claude/continue-projetoifp-section-10-RKC1n`. Produção: `ifp-final` (`2eebf94`).
> Padrão de execução: esteira ralphinho — **unidades SEQUENCIAIS** (working tree é único e compartilhado),
> cada uma: implementar CASA → estender `scripts/valida-*.mjs` → `pnpm typecheck` verde → build+`valida` verde
> → `git fetch`/rebase → commit+push. **Sem `prisma migrate reset`** (bloqueado p/ agentes); migrations só **aditivas**.

## 🚦 Mapa de desbloqueio (o que é autônomo vs. o que precisa de você)

| Onda | Grupo | Autônomo agora? | Gate externo (decisão/credencial sua) |
|---|---|---|---|
| **A** | Fazer-já | ✅ **100%** | nenhum |
| **C** | Storage + envio | 🟡 **parcial** | MinIO já no ar (`ifp_minio_dev`); falta wiring + creds. **Envio** e-mail/WhatsApp = credencial de gateway |
| **B** | Camada de IA | 🟡 **scaffolding** | `ANTHROPIC_API_KEY` + **sua assinatura LGPD** p/ enviar dado clínico a API externa |
| **E** | Site público | 🟡 **parcial** | já há estático do Designer; **doações/PIX** = gateway de pagamento |
| **D** | Dados novos | 🟢 modelos | precisa modelar + alguém alimentar; valor baixo |

Regra: **a esteira constrói tudo que dá até o gate** e **para no gate**, sinalizando a decisão — nunca envia dado sensível
a serviço externo, nem mexe em produção, sem OK explícito seu.

---

## 🅰️ ONDA A — fazer-já (autônoma, roda já)

Itens sem dependência externa do `GAP-ATUAL`. Todos preferencialmente **zero-migration** (agregação/UI sobre dados já existentes).

### A1 — Presidência: dashboard de saúde populacional `[Tier 2]`
- **depends_on:** —
- **scope:** endpoint read-only que agrega dados clínicos JÁ existentes (atendimentos/triagens/prontuários/`fichaCidada`) por faixa etária, bairro e condição; tela CASA na Presidência com KPIs + gráfico simples (reusa o padrão de `presidencia/territorio` da Onda D e `presidencia-impacto`). Sem geo falso; só dado real.
- **acceptance_tests:** estende `scripts/valida-presidencia.mjs` (ou novo `valida-presidencia-saude.mjs`): GET agrega ≥1 recorte real, RBAC `@Perfis(PRESIDENCIA, SUPER_ADMIN)`, isolamento tenant. Verde.
- **risk_level:** médio (dado clínico agregado — anonimizado/contado, nunca individualizado). **rollback:** reverter commit (read-only, sem schema).

### A2 — Capacitação: indicadores longitudinais `[Tier 2]`
- **depends_on:** —
- **scope:** séries temporais de matrículas/conclusões/certificados/evasão por período; reusa o padrão de impacto longitudinal (`presidencia-impacto`/`$queryRawUnsafe` saneado). Tela de indicadores no módulo Capacitação.
- **acceptance_tests:** estende `valida-cursos.mjs` (ou `valida-presidencia-impacto.mjs`): GET retorna série temporal coerente, sem SQLi, RBAC. Verde.
- **risk_level:** baixo. **rollback:** reverter commit.

### A3 — Capacitação: filtros/busca + widgets do painel `[Tier 1]`
- **depends_on:** A2 (reusa hooks/tela)
- **scope:** filtros (status/período/unidade) e busca em certificados e turmas; widgets de resumo no painel da Capacitação. Predominante frontend + query params no service existente.
- **acceptance_tests:** estende `valida-cursos.mjs`/`valida-matriculas-certificados.mjs`: GET com filtros retorna subconjunto correto. Verde + `typecheck`/`lint` web.
- **risk_level:** baixo. **rollback:** reverter commit.

### A4 — Esportivo: graduação visível à família `[Tier 1]`
- **depends_on:** —
- **scope:** Portal da Família exibe as graduações/diplomas do atleta (reusa o gerador de diploma PDF + verificação do Grupo A já no ar). Read-only no contexto família.
- **acceptance_tests:** estende `valida-esportivo.mjs`/`valida-familia.mjs`: família vê graduação do próprio vínculo; não vê de terceiros (tenant/escopo). Verde.
- **risk_level:** baixo. **rollback:** reverter commit.

### A5 — Verificação pública: digitar código manual + guia "como ser atendido" `[Tier 1]`
- **depends_on:** —
- **scope:** rota pública com campo p/ digitar o código do documento manualmente (hoje só por QR) → bate em `/verificar-documento`; página estática "como ser atendido" (guia do cidadão). UI pública, sem auth.
- **acceptance_tests:** estende `valida-*` de verificação (ou smoke no script existente): código válido → 200/achado, inválido → not-found amigável. Verde.
- **risk_level:** baixo (público, read-only). **rollback:** reverter commit.

### A6 — Admin: painel de configuração da plataforma `[Tier 2/3]`
- **depends_on:** —
- **scope:** painel Admin que **lê e exibe** a configuração da plataforma (unidades, perfis, parâmetros já existentes) e permite ajustar parâmetros simples. **Preferir zero-migration** (reusar `Unidade`/config existente); se exigir parâmetro novo persistido, **1 migration ADITIVA** (`Configuracao` key/value) — flag no scorecard.
- **acceptance_tests:** novo `valida-admin-config.mjs`: GET config 200 c/ RBAC `@Perfis(SUPER_ADMIN)`; PUT parâmetro persiste + auditoria LGPD. Verde.
- **risk_level:** médio-alto (auth/admin). **rollback:** reverter commit (+ migration aditiva é reversível por estar vazia).

**Saída da Onda A:** scorecard por unidade + `valida-*` verdes + commits empurrados. Deploy na `ifp-final` ao fim (só `git pull`→build→`up -d`; migrate só se A6 gerar migration).

---

## 🅲 ONDA C — storage + envio (parcial; MinIO já no ar)

**Achados do scout (24/06):** o MinIO roda em `ifp_minio_dev` (:9000 API / :9001 console; creds dev fora do git, injetadas no prompt da esteira). O schema **JÁ TEM** o modelo `Documento` (campos `url // S3/R2/MinIO`, `nomeArquivo`, `tipo TipoDocumento`, FK `FichaCidada.documentos`), `DocumentoMedico` e campos `fotoUrl` — ou seja, **o data model de storage já existe**; falta o wiring. A API **não tem** módulo de storage hoje (zero MinIO/S3). Notificação in-app já existe (`/notificacoes`, Onda D).

### C1 — Fundação de storage (StorageService + MinIO) `[Tier 3]`
- **depends_on:** —
- **scope:** adicionar o client MinIO (pkg `minio`) ao `@ifp/api`; `StorageModule`+`StorageService` (putObject/presignedGetUrl/removeObject) lendo `MINIO_*` do env; bootstrap idempotente do bucket no start; documentar `MINIO_*` no `.env` (dev) e `.env.example`. Endpoint `GET /admin/storage/health` (`@Perfis(SUPER_ADMIN)`) que faz round-trip put+get de um objeto temпорário.
- **acceptance_tests:** `scripts/valida-storage.mjs`: health 200 com round-trip ok; 403 p/ não-admin. **rollback:** reverter commit (dep nova é reversível).
- **risk_level:** alto (infra/dependência nova). ZERO-MIGRATION.

### C2 — Upload de documento na ficha cidadã `[Tier 3, LGPD]`
- **depends_on:** C1
- **scope:** `POST /fichas-cidadas/:id/documentos` (multipart, FileInterceptor) → StorageService.put → cria linha `Documento` (REUSA o model existente, **ZERO-MIGRATION**); `GET .../documentos` (lista), `GET .../documentos/:docId` (download por presigned URL com checagem ownership/tenant/RBAC), `DELETE`. UI na ficha (upload + lista + baixar). Limite de tamanho/MIME; trilha LGPD.
- **acceptance_tests:** `valida-documentos-ficha.mjs`: upload→201+linha, lista, download presigned, **IDOR/tenant** (profissional de outra unidade não baixa), RBAC, delete. **rollback:** reverter commit.
- **risk_level:** alto (dado sensível). ZERO-MIGRATION (model já existe).

### C3 — Fotos no diário da creche `[Tier 3, LGPD afetivo]`
- **depends_on:** C1
- **scope:** anexar foto(s) ao registro do diário; família do aluno vê. Reusar `fotoUrl` se servir, senão 1 migration ADITIVA (`FotoDiario`). Watermark é desejável (ver comentário do schema) mas opcional nesta unidade.
- **acceptance_tests:** `valida-edu-fotos.mjs`: educadora sobe foto no diário, família DAQUELE aluno vê, outra família NÃO vê. **rollback:** reverter commit (+ migration aditiva vazia, reversível).
- **risk_level:** alto. Aditiva só se preciso.

### C4 — Notificação in-app à família (eventos de storage) `[Tier 2]`
- **depends_on:** C2/C3
- **scope:** estender o `/notificacoes` (Onda D) p/ a família receber aviso in-app de novo documento/foto/registro (SEM envio externo). Sino na topbar já existe.
- **acceptance_tests:** estende `valida-notificacoes.mjs`: evento de storage gera notificação ao perfil família, com tenant/RBAC. ZERO-MIGRATION (reusa agregação).
- **risk_level:** médio.

> **Gate (seu) — fora desta onda autônoma:** **envio externo** (recuperação de senha por e-mail; push/WhatsApp real) = credencial de SMTP/WhatsApp do Vaultwarden. Defino os campos de config; ligo quando você passar a credencial.

## 🅱 ONDA B — camada de IA (scaffolding; precisa de chave + LGPD)
- **Autônomo:** fundação `@ifp/ai` (cliente Anthropic Opus, fila de **revisão humana obrigatória**, log de auditoria LGPD, feature-flag OFF por padrão) + os 5 consumidores atrás da flag: resumo clínico · triagem assistida · resumo do dia (creche) · histórias de impacto · áudio/TTS do diário.
- **Gate (seu):** **`ANTHROPIC_API_KEY`** + **sua decisão LGPD explícita** de enviar dado clínico/sensível a API externa (com quais guardas: anonimização, consentimento, retenção). Sem isso a flag fica OFF e nada é enviado. **Não ligo sozinho.**

## 🅴 ONDA E — site público (parcial; PIX é gate)
- **Autônomo:** portar o estático do Designer (`site-institucional/`, já servido como landing em prod) p/ páginas ricas: landing institucional, unidades, transparência, voluntariado, contato (formulários → in-app/ticket).
- **Gate (seu):** **doações/PIX** = gateway de pagamento (qual provedor + credencial).

## 🅳 ONDA D — dados novos (baixa prioridade)
- Custo por beneficiário · CRM de doadores · mapa geográfico real (lat/long) · transparência pública. Precisa modelar + você/equipe alimentar. Fica por último; faço os modelos+telas vazias quando priorizar.

---

## 📋 Merge queue / verificação (todas as ondas)
1. Nunca commitar unidade com `valida-*` vermelho ou `typecheck` quebrado.
2. `git fetch`+rebase na integração antes de cada push (branch é compartilhada — avança no servidor/outras máquinas).
3. Re-rodar `pnpm typecheck` do **repo inteiro** (inclui `@ifp/database`) após cada merge.
4. Smoke no navegador + deploy `ifp-final` é passo do **orquestrador** (humano-no-loop), não dos agentes.
