# IFP Connect — MVP "Núcleo Transversal" — Design Spec

**Data:** 2026-05-23
**Autor:** Erick Ramos (kiizinbr) · em colaboração com Claude
**Status:** Aprovado para implementação
**Repositório:** https://github.com/kiizinbr/kiizinbr-ifp-familiaponcio
**Base anterior:** `projetoifp.md` (tratado como ponto de partida; ajustes nesta spec prevalecem)

---

## 1. Contexto

Instituto Família Pôncio (IFP) é entidade filantrópica em Duque de Caxias (RJ), presidida por Simone Pôncio. Atende população vulnerável via 4 unidades — Centro Médico, Centro de Capacitação, Centro Esportivo, Centro Recreativo/Educacional — com triagem pelo Serviço Social.

O IFP Connect é a plataforma única para operar essas unidades. Esta spec cobre **apenas o MVP** (chamado "Núcleo Transversal"), que é a fundação reaproveitada por todas as unidades. Cada unidade vira sua própria spec subsequente.

## 2. Escopo do MVP

### 2.1 No escopo

- **Autenticação + RBAC** com 7 perfis: Super Admin, Presidência, Serviço Social, Gestor de Unidade, Profissional, Recepção, Responsável Familiar.
- **Ficha Cidadã unificada** — cadastro do beneficiário usável por todas as unidades.
- **Triagem Social** — entrevista, situação socioeconômica, parecer, elegibilidade.
- **Fluxo de aprovação multi-unidade** — Serviço Social libera/encaminha; Gestor da unidade vê só o necessário.
- **LGPD baseline** — consentimento versionado, ROPA, direitos do titular (Art. 18), audit log, retenção configurável.
- **Importador genérico** de cadastros — CSV (Amplimed, Google Sheets, planilhas internas) com mapeamento de colunas, dry-run, deduplicação por CPF e status `migrado` que exige validação humana.
- **Dashboard Presidência** com métricas **agregadas** (nunca dados individuais sensíveis).
- **Hospedagem:** VM Linux no CL-SRV-DC01 com Docker Compose, backup automático off-site para Azure Blob.

### 2.2 Fora do escopo (entram em fases seguintes)

- Módulos por unidade (cursos, agendas médicas, prontuário, turmas esportivas, creche).
- Prontuário eletrônico (CFM 1.821/2007, NGS2 SBIS, ICP-Brasil) — F5.
- Integrações externas: e-SUS, SUSAF, gov.br, e-mail transacional em escala.
- App mobile nativo (web responsivo cobre).
- Dark mode.
- Multi-idioma.
- Microserviços, fila/worker — modular monolith é suficiente neste estágio.

## 3. Decisões arquiteturais

### 3.1 Stack

| Camada | Escolha | Justificativa |
|---|---|---|
| Frontend + Backend | **Next.js 16** (App Router, Server Components, Server Actions, Cache Components) | Full-stack num único repo elimina NestJS; reduz superfície de erro; Cache Components dão revalidação granular sem Redis |
| Linguagem | **TypeScript estrito** | `strict: true`, sem `any` implícito |
| UI base | **Tailwind CSS + shadcn/ui** | Acessibilidade WCAG AA grátis, totalmente customizável, sem lock-in |
| Design tokens | **CSS variables a partir do brandbook IFP** | Paleta por unidade já mapeada (#FF772E, #10C2BB, #752C05, #007571) |
| Tipografia | **Garet** (com fallback Inter / Plus Jakarta Sans) | Conforme brandbook |
| ORM | **Prisma** | Migrações versionadas; tipagem ponta a ponta |
| Banco | **PostgreSQL 16** com **Row-Level Security** | Isolamento ao nível de linha — defesa em profundidade |
| Auth | **Auth.js v5** (credentials + Magic Link opcional, **TOTP MFA** para perfis administrativos) | Maduro, integra direto com Next.js |
| Storage | **MinIO** (S3-compatible) on-premise; migração futura para Azure Blob | Anexos da Ficha Cidadã, sem lock-in |
| Container | **Docker + Docker Compose** | Mesma imagem rodando em VM hoje e em Container Apps amanhã |
| CI/CD | **GitHub Actions** | Build → test → push image → deploy via SSH/WireGuard |
| Observabilidade | **OpenTelemetry → Grafana + Loki** (self-hosted) | Logs estruturados + traces sem custo de SaaS |
| Validação | **Zod** | Schema único compartilhado entre form, action e DB |
| Testes | **Vitest** (unit) + **Playwright** (e2e) + **pgTAP** (RLS policies) | RLS precisa ser testado como código |

### 3.2 Princípios

1. **12-factor + container-first.** Configuração via env. Stateless app. Migrar VM ⇄ Azure é trocar runtime, não reescrever.
2. **Defesa em profundidade.** Auth no app + RBAC no middleware + RLS no banco. Bug em qualquer camada não vaza dado.
3. **Audit by default.** Trigger Postgres grava em `audit_log` toda escrita em tabelas marcadas como sensíveis.
4. **LGPD by design.** Consentimento granular. Soft-delete com retenção configurável. Exportação do titular pronta no MVP.
5. **Modular monolith.** Pastas por bounded context (`auth`, `citizens`, `screening`, `consents`, `import`). Cada módulo expõe API interna explícita.

### 3.3 Diagrama

```
Browser → Caddy (TLS) → Next.js 16 → Prisma → PostgreSQL 16 (+ RLS)
                            ↓                       ↓
                          MinIO (S3)         audit_log + pg_dump
                                                    ↓
                                            Azure Blob (backup)
```

## 4. Modelo de dados (núcleo)

```sql
-- Tenant/escopo
units                  (id, codigo, nome, paleta_jsonb)
-- 'medico' | 'capacitacao' | 'esportivo' | 'educacional'

-- Beneficiário
citizens               (id, cpf UNIQUE, nome_civil, nome_social,
                        nascimento, contato_jsonb, endereco_jsonb,
                        status ENUM('rascunho','migrado','ativo','arquivado'),
                        created_by, created_at, updated_at, deleted_at)
family_members         (id, citizen_id FK, nome, parentesco,
                        nascimento, renda, escolaridade)
attachments            (id, citizen_id FK, kind, mime, url, hash_sha256,
                        uploaded_by, uploaded_at)

-- Triagem Social
screenings             (id, citizen_id FK, social_worker_id FK,
                        data_entrevista, situacao_socio_jsonb,
                        parecer_md, status ENUM('aberta','concluida'),
                        created_at, closed_at)
unit_eligibility       (id, screening_id FK, unit_id FK,
                        status ENUM('pendente','aprovado','negado','encaminhado'),
                        motivo, decided_by, decided_at)

-- RBAC
users                  (id, email UNIQUE, hashed_password, nome,
                        mfa_enabled, mfa_secret_enc, created_at)
user_roles             (user_id FK, role ENUM, unit_id FK NULL)
-- role: super_admin | presidencia | social | gestor | profissional |
--       recepcao | responsavel
-- unit_id presente quando o papel é escopado a uma unidade

-- LGPD
consents               (id, citizen_id FK, finalidade,
                        base_legal ENUM, versao_termo,
                        timestamp, ip, user_agent,
                        evidencia_jsonb, revoked_at)
data_subject_requests  (id, citizen_id FK, kind ENUM('acesso','correcao',
                        'exclusao','portabilidade'), status,
                        opened_at, resolved_at, evidence_url)

-- Auditoria
audit_log              (id BIGSERIAL, actor_user_id, action,
                        target_table, target_id, before_jsonb,
                        after_jsonb, ip, timestamp)
-- preenchido por TRIGGER Postgres em tabelas marcadas sensíveis

-- Importação
import_jobs            (id, source ENUM('amplimed_csv','sheets_csv',
                        'manual'), filename, uploaded_by, mapping_jsonb,
                        dry_run BOOL, status, stats_jsonb, started_at,
                        finished_at)
import_rows            (id, job_id FK, row_index, raw_jsonb,
                        matched_citizen_id NULL, action_taken,
                        warnings_jsonb)
```

**Schema reservado:** `clinical.*` será criado em F5 (Centro Médico) com policies RLS ainda mais restritas (Presidência **nunca** acessa). O MVP já prevê o ponto de extensão.

### 4.1 Row-Level Security

Cada request seta variáveis de sessão Postgres:
```sql
SET LOCAL ifp.user_id = '<uuid>';
SET LOCAL ifp.roles   = '{social,super_admin}';
SET LOCAL ifp.units   = '{medico}';
```

Policy exemplo (Ficha Cidadã visível por Serviço Social ou unidades onde o cidadão é elegível):
```sql
CREATE POLICY citizens_read ON citizens
FOR SELECT USING (
  'super_admin' = ANY(current_setting('ifp.roles')::text[])
  OR 'social'   = ANY(current_setting('ifp.roles')::text[])
  OR EXISTS (
    SELECT 1 FROM unit_eligibility ue
    JOIN screenings s ON s.id = ue.screening_id
    WHERE s.citizen_id = citizens.id
      AND ue.status = 'aprovado'
      AND ue.unit_id = ANY(current_setting('ifp.units')::uuid[])
  )
);
```

Testes RLS escritos em **pgTAP** — qualquer regressão de policy falha o CI.

## 5. Fluxos críticos

### 5.1 Golden path — cadastro e triagem

1. Recepção busca CPF → não acha → cria pré-cadastro mínimo (`status='rascunho'`).
2. Cidadão lê e aceita **termo de consentimento LGPD** (versionado, evidência gravada em `consents`).
3. Assistente social abre rascunho, conduz entrevista, anexa documentos, registra parecer (`screenings`).
4. Sistema sugere unidades elegíveis com base em regras configuráveis (renda, faixa etária, vaga).
5. Assistente social aprova/encaminha → `unit_eligibility.status = 'aprovado'`.
6. Gestor da unidade recebe notificação; vê só campos liberados (RLS bloqueia o resto).
7. Cidadão passa a `status='ativo'`.

### 5.2 Direitos do titular LGPD

- **Tela "Meus Dados"** (acessível ao próprio cidadão ou ao responsável familiar): export JSON + PDF.
- **Solicitação de exclusão** via formulário → cria `data_subject_request` → DPO aprova ou justifica retenção legal (5 anos contábil) → execução com evidência registrada.

### 5.3 Importação de cadastros externos

1. Usuário com perfil `super_admin` ou `social` envia CSV (Amplimed, Google Sheets, etc.).
2. Wizard de **mapeamento de colunas** — UI mostra primeiras linhas, usuário liga coluna do CSV a campo da Ficha Cidadã. Mapeamentos salvos como template reusável por origem.
3. **Dry-run obrigatório:** sistema processa sem persistir, retorna estatísticas (X criados, Y deduplicados por CPF, Z com warning).
4. Após revisão, execução real cria registros com `status='migrado'`.
5. Cidadãos importados **não podem ser encaminhados** sem antes Serviço Social (a) validar dados e (b) coletar consentimento LGPD presencial. Status só vira `ativo` após isso.
6. `import_jobs` e `import_rows` ficam para auditoria.

## 6. UI/UX direction

- Mantém o **brandbook IFP** (paleta por unidade, Garet, leão coroado).
- **Identidade do Serviço Social** = azul-neutro institucional — não confunde com cores de unidade.
- **Modo denso** para staff (recepção, social) — tabelas com mais info por linha, atalhos de teclado.
- **Modo confortável** para beneficiário e responsável familiar — fontes maiores, contraste alto, menos info por tela.
- **Mobile-first em recepção** — tablet Android é onde o cadastro acontece. Layout em uma coluna, inputs grandes.
- **Acessibilidade WCAG AA** garantida via shadcn/ui + audit Lighthouse no CI.
- Skill `frontend-design` será invocada durante implementação de UI para evitar estética genérica.

## 7. Hospedagem operacional

### 7.1 VM no CL-SRV-DC01 (deploy inicial)

- Hyper-V VM dedicada, **Ubuntu Server 22.04 LTS**, 4 vCPU / 8GB RAM / 80GB.
- Disco VHDX dinâmico em volume separado da CLEAN.
- **vSwitch isolada** — sem broadcast compartilhado com Domain clean.lan.
- **Caddy** proxy reverso com Let's Encrypt automático.
- Domínio sugerido: `app.familiaponcio.org.br` (a confirmar com IFP).
- Acesso administrativo apenas via WireGuard.

### 7.2 Backup (crítico)

- `pg_dump` diário, cifrado com **age**, upload pra **Azure Blob Storage** (Brazil South, tier Cool — free tier cobre meses iniciais).
- Snapshot Hyper-V semanal mantido localmente (rotação 4 semanas).
- **Teste de restore mensal documentado** (não confiar em backup que nunca foi restaurado).

### 7.3 Migração para Azure (quando houver budget)

- `docker compose down` na VM → restore do dump em **Azure Postgres Flexible Server** (B1ms) → `az containerapp up` com mesma imagem → DNS aponta para Container Apps.
- Janela estimada: ~1h noturna.

## 8. LGPD baseline (Lei 13.709/2018)

Entram **no MVP**:

- Termo de consentimento **versionado por finalidade** (cadastro, foto, contato, encaminhamento).
- **Base legal explicitada por operação** (Art. 7º): consentimento, tutela da saúde, política pública, execução de contrato.
- **ROPA** (Registro das Operações de Tratamento) gerado a partir de metadados do schema.
- **Direitos do titular (Art. 18):** acesso, correção, exclusão, portabilidade, anonimização.
- **DPO designado** — Erick Ramos inicialmente, com revisão jurídica antes do go-live.
- **Audit log imutável** das operações sensíveis.
- **Política de retenção** — citizen_id retido 5 anos após último atendimento (regra contábil/fiscal).
- **Política de cookies** mínima — só cookies essenciais de sessão; sem analytics de terceiros.

Adiados para **F2 em diante:** PIA formal, contrato DPA com fornecedores externos quando entrar e-mail transacional em escala (SendGrid/Resend).

## 9. Estratégia de migração de dados

### 9.1 Origens identificadas

| Origem | Sistema | Formato | Volume estimado | Fase de migração |
|---|---|---|---|---|
| Centro Médico | **Amplimed** | CSV export nativo | "quantidade boa" — confirmar com Erick | F5 ou pré-piloto MVP para validar importer |
| Capacitação | **Google Sheets** | CSV export | A confirmar | F2 |
| Outras | Manual / planilhas internas | CSV / XLSX | Variável | Conforme surgirem |

### 9.2 Decisões

1. **Importador entra no MVP**, não em F2/F5. Sem ele, cada migração vira código novo.
2. Importer é **genérico via mapeamento de colunas**, não acoplado a um fornecedor.
3. **Dedup por CPF** quando presente; quando ausente, heurística nome+nascimento com flag de warning para revisão humana.
4. Registros importados ficam **`status='migrado'`** até Serviço Social validar e coletar consentimento LGPD presencial.
5. **Templates de mapeamento** salvos por origem (Amplimed, Sheets) — reuso em futuras importações.
6. **Não há herança de consentimento** de sistemas anteriores. Erick: confirmar com jurídico se há base legal alternativa (execução de política pública) para os dados já existentes durante o período de transição.

### 9.3 Ação imediata pré-implementação

- Erick exporta **um sample CSV anonimizado** de cada origem (Amplimed + Sheets) → guarda em `docs/migration-samples/` (com .gitignore se contiver dados reais) → spec do importer ajusta-se aos campos reais.

## 10. Roadmap pós-MVP

| Fase | Conteúdo | Sprint estimado | Pré-requisitos |
|---|---|---|---|
| **MVP** | Núcleo Transversal completo (esta spec) | 6–8 semanas | — |
| **F2** | Centro de Capacitação (cursos, turmas, frequência, certificados) | +4–6 sem | MVP em produção |
| **F3** | Centro Esportivo (turmas, presença, graduação Jiu-Jitsu) | +2–3 sem | MVP em produção |
| **F4** | Centro Recreativo/Educacional (creche: atividades, alimentação, descanso) | +4 sem | MVP em produção, CMDCA |
| **F5** | Centro Médico (agenda + prontuário simplificado) | +8–10 sem | MVP + CFM 1.821, NGS2, ICP-Brasil |
| **F6** | Dashboard agregado Presidência | paralelo F2–F4 | F2 ou F3 em produção |
| **F7** | Migração para Azure Container Apps | 1 sprint | Budget Azure aprovado |

## 11. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Backup do CL-SRV-DC01 ainda não validado (F0/F1 do plano CLEAN) | Perda de dados de beneficiários | Backup off-site Azure Blob **desde o dia 1**; teste de restore mensal documentado |
| Blast radius compartilhado com CLEAN | Incidente em uma derruba a outra | VM isolada com vSwitch própria; recursos limitados (4 vCPU / 8GB); migração Azure planejada |
| Single dev (Erick) | Bus factor 1 | Doc no repo; commits pequenos; spec antes de código; testes como documentação executável |
| LGPD descumprida em produção | Multa + reputação | DPO designado, revisão jurídica antes do go-live, audit log imutável |
| Escopo aumenta antes do MVP terminar | Travamento (já aconteceu) | Quaisquer pedidos de unidade durante MVP entram em backlog F2+, **sem exceção** |
| CSV da Amplimed em formato proprietário | Importer não cobre | Sample CSV antes do código; testes do importer rodam contra samples reais |

## 12. Itens em aberto (a confirmar com Erick antes do plano)

- Domínio definitivo da aplicação (sugestão: `app.familiaponcio.org.br`).
- Existência e formato exato do export CSV da Amplimed (sample anonimizado).
- Logo IFP em vetor (SVG) e arquivo Garet (otf/woff2).
- Lista nominal dos usuários piloto (assistente social + recepção + Erick + Presidência).
- Endereço fiscal e CNPJ do IFP para footer e documentos LGPD.
- DPO formal — Erick aceita o papel inicialmente? Quando passa para alguém da IFP?
