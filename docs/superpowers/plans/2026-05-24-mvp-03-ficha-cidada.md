# IFP Connect MVP — Plano 3: Ficha Cidadã — Implementation Plan (DRAFT)

> **Status:** DRAFT — escrito sem input do Erick durante autopilot overnight 2026-05-24. Tarefas e estrutura prontas; **decisões abertas (seção 0) precisam ser resolvidas antes da execução**.
>
> **Depende de:** Plano 2 RBAC + RLS pronto (campos sensíveis + isolamento por unidade já existem).

**Goal:** Implementar o cadastro central da plataforma — a "Ficha Cidadã" — usado como ponto único de identificação de qualquer pessoa atendida pelo IFP, com integração de anexos (documentos, fotos), busca e histórico de mudanças.

**Architecture:** Modelo `Cidadao` com campos próprios + relação 1:N com `Endereco`, 1:N com `AnexoCidadao` (armazenamento no MinIO via presigned URL), 1:N com `Familiar` (dependentes). Mudanças registradas via audit log do Plano 2. Busca via Postgres trigram (`pg_trgm`) — full-text simples no MVP, semantic search no Plano A.3 (CLEANHUB).

**Plano base:** Plano 2 RBAC (✅ ou em andamento).

---

## 0. DECISÕES ABERTAS (resolver antes de executar)

### ✅ 0.1 Schema — FECHADA em 2026-05-24

**Obrigatórios (4):**

- `nome_completo` (string)
- `cpf` (string, único, 11 dígitos normalizado)
- `data_nascimento` (date)
- `telefone_principal` (string)

**NÃO incluir** (dados sensíveis LGPD art. 5º II — sem ganho operacional):

- `orientacao_sexual`
- `religiao`

**Opcionais — Identificação:**

- `nome_social` (LGBTQIA+, pessoas trans — dignidade no atendimento)
- `rg` (alguns só CIN ou RG vencido)
- `documento_alternativo` (CNH, passaporte — pra quem não tem RG normal)
- `genero` (enum: feminino / masculino / nao_binario / nao_informar)
- `cor_raca` (enum IBGE: branca / preta / parda / amarela / indigena)
- `estado_civil` (enum)
- `nacionalidade` (string)
- `naturalidade` (cidade + UF de nascimento)
- `nome_mae` (importante pra menor de idade — responsável legal)
- `nome_pai` (idem)
- `escola_atual` (criança/adolescente do recreativo/capacitação)

**Opcionais — Contato:**

- `telefone_secundario`
- `email`
- `whatsapp_consente` (boolean — LGPD base legal pra contato WhatsApp)

**Opcionais — Socioeconômico** (visíveis SÓ pra perfil `social` — Regina + equipe):

- `renda_familiar` (decimal)
- `pessoas_na_casa` (int)
- `beneficio_social` (enum: bolsa_familia / bpc / nenhum / outro)
- `escolaridade` (enum)
- `trabalha` (boolean) + `trabalho_descricao` (text)

**Opcionais — Saúde** (visíveis SÓ pra perfis `profissional` do Centro Médico):

- `tipo_sanguineo` (enum)
- `alergias` (text)
- `medicamentos_em_uso` (text)
- `condicoes_cronicas` (text)

**Sistema (automático):**

- `id`, `created_at`, `updated_at`, `deleted_at`
- `foto_url` (campo separado da tabela Anexo — decisão §0.5)
- `created_by_id` (User)
- `unit_id_origem` (qual unidade fez primeiro cadastro)
- `anonimizado_em` (timestamp, NULL = não anonimizado — usado pra LGPD §0.9)

**Total**: 4 obrigatórios + 23 opcionais + 7 sistema = **34 campos**.

Decisão guiada por: "se algo não for necessário, depois verifica" (Erick) — privilegiar mais campos opcionais que menos.

### ✅ 0.2 CPF — FECHADA em 2026-05-24

**Decisão:** CPF **OBRIGATÓRIO** (não permite cadastro sem CPF). Único. Valida dígito verificador antes de salvar. Normaliza pra 11 dígitos no DB (sem ponto/traço). Máscara só visual no form.

**Trade-off conhecido:** atendimento de pessoa sem documento fica bloqueado. Recepção precisa orientar regularização antes. Pode evoluir pra "CPF obrigatório com exceção via super_admin" no futuro se necessário.

### ✅ 0.3 Endereço — FECHADA em 2026-05-24

**Decisão:** Tabela `Endereco` **1:N** (residencial / trabalho / contato com `tipo` enum). Auto-complete via **BrasilAPI** ao digitar CEP → preenche logradouro/bairro/cidade/UF; recepção completa número e complemento. **Sem geocoding** (lat/long) no MVP.

### ✅ 0.4 Familiares — FECHADA em 2026-05-24

**Decisão:** Opção **C** — `Familia` agrupa + `Cidadao` membro. Cada membro pode ser Cidadao próprio (com Ficha completa) OU só `Familiar` (nome, parentesco, idade — sem Ficha). Simplifica relatórios "famílias atendidas" vs "indivíduos atendidos".

### ✅ 0.5 Anexos — FECHADA em 2026-05-24

**Decisão:**

- **Tipos**: PDF, JPG, PNG (sem Office docs — vetor macro malware)
- **Tamanho**: max **10MB/arquivo**, total **100MB/cidadão**
- **Bucket MinIO**: `ifp-cidadao-anexos`
- **Naming**: hash (SHA-256 do conteúdo) — evita colisão e duplicidade
- **Antivírus**: NÃO no MVP (ClamAV futuro)
- **Foto do cidadão**: campo `foto_url` **separado** da tabela de anexos

### ✅ 0.6 Busca — FECHADA em 2026-05-24

**Decisão:** Trigram fuzzy (`pg_trgm`) em `nome_completo + nome_social + cpf + telefone_principal`. Tolerância erro via `similarity > 0.3` (Maria Silba encontra Maria Silva). Filtros: unidade + status + faixa etária + data cadastro. Busca semântica pra futuro (Plano A.3 CLEANHUB-like).

### ✅ 0.7 UI form — FECHADA em 2026-05-24

**Decisão:** Form **tabbed** — 7 abas em ordem: Identificação / Contato / Endereço / Socioeconômico / Saúde / Anexos / Família. Salvamento parcial automático após Identificação válida (cria draft). Validação inline campo-a-campo (zod + react-hook-form). **Mobile-first** (recepção usa tablet).

### ✅ 0.8 Histórico — FECHADA em 2026-05-24

**Decisão:** Audit log captura `entity=cidadao, action=update, meta={changedFields, oldValue, newValue}`. UI mostra **timeline simples** (quem, quando, qual campo) sem diff visual fancy. Evolução pós-MVP.

### ✅ 0.9 Soft delete + LGPD — FECHADA em 2026-05-24

**Decisão:** Soft delete por default (`deleted_at`). Botão **"Excluir definitivamente (LGPD)"** SOMENTE pra `super_admin` (Erick) — anonimiza (PII vira `[anonimizado]`) e mantém `id` + counters pra relatórios. **Hard delete NUNCA** (compliance).

### ✅ 0.10 Importador — FECHADA em 2026-05-24

**Decisão:** Importador (CSV Amplimed + Google Sheets) confirmado **fora do Plano 3** → vai pro **Plano 6** separado.

---

## File Structure (criado neste plano)

```
ifp-connect/
├── prisma/
│   ├── migrations/<ts>_add_cidadao/
│   │   ├── migration.sql              # Cidadao + Familia + Endereco + AnexoCidadao
│   │   └── trigram.sql                # CREATE EXTENSION pg_trgm + indexes
│   └── schema.prisma                  # +Cidadao +Familia +Endereco +AnexoCidadao
├── src/
│   ├── lib/
│   │   ├── cidadao.ts                 # CRUD helpers (with RBAC checks)
│   │   ├── cpf.ts                     # validateCpf(), normalizeCpf(), formatCpf()
│   │   ├── cep.ts                     # fetchAddressFromCep() via BrasilAPI
│   │   └── minio.ts                   # presigned URL helpers (upload, download)
│   └── app/
│       └── app/
│           └── cidadaos/
│               ├── page.tsx           # lista + busca + filtros
│               ├── novo/
│               │   ├── page.tsx       # wrapper
│               │   └── form.tsx       # tabbed form (client)
│               └── [id]/
│                   ├── page.tsx       # detalhe (read-only)
│                   ├── editar/
│                   │   └── page.tsx   # mesmo form, modo edit
│                   ├── anexos/
│                   │   └── page.tsx   # gestão de anexos
│                   └── historico/
│                       └── page.tsx   # timeline do audit log
└── tests/
    ├── unit/
    │   └── cpf.test.ts                # validateCpf
    └── e2e/
        └── cidadao-crud.spec.ts       # criar, editar, buscar, soft delete
```

---

## Tasks (estrutura, executa após decisões 0.x)

### Task 1: Schema Cidadao + Familia + Endereco + AnexoCidadao

- Models Prisma com campos conforme §0.1
- Migration `add_cidadao`
- Extensão `pg_trgm` + indexes GIN em campos pesquisáveis (§0.6)

### Task 2: Helpers `cpf.ts`, `cep.ts`

- `validateCpf(cpf: string): boolean` (algoritmo dígito verificador)
- `normalizeCpf(cpf: string): string` (remove pontos/traços)
- `formatCpf(cpf: string): string` (000.000.000-00)
- `fetchAddressFromCep(cep: string): Promise<Address | null>` (BrasilAPI v1)
- Testes unit em `tests/unit/cpf.test.ts`

### Task 3: CRUD `lib/cidadao.ts` com RBAC

- `createCidadao(data, ctx)` — checa role pode criar nessa unidade
- `getCidadao(id, ctx)` — RLS filtra
- `listCidadaos(filters, ctx)` — search + paginação
- `updateCidadao(id, data, ctx)` — checa role pode editar
- `softDeleteCidadao(id, ctx)` — checa role
- `anonymizeCidadao(id, ctx)` — só super_admin (LGPD)

### Task 4: MinIO upload via presigned URL

- `lib/minio.ts`: `getUploadUrl(cidadaoId, filename, contentType)`, `getDownloadUrl(anexoId)`
- Cria bucket `ifp-cidadao-anexos` no startup se não existe
- Server Action `requestUploadUrl()` checa role + retorna URL temporária
- Client upload direto pro MinIO (não passa pelo Next.js)

### Task 5: Lista `/app/cidadaos`

- Tabela com search box (debounced 300ms)
- Filtros: unidade (multi-select), status, faixa etária, data cadastro
- Paginação cursor-based (50 por página)
- Botão "+ Novo cidadão" (se role pode criar)

### Task 6: Form `/app/cidadaos/novo` (tabbed)

- 7 tabs (conforme §0.7): Identificação / Contato / Endereço / Socioeconômico / Saúde / Anexos / Família
- Salvamento parcial após Identificação válida (cria draft)
- Validação inline com zod + react-hook-form
- Auto-completar CEP

### Task 7: Detalhe `/app/cidadaos/[id]`

- Read-only view do cadastro completo
- Cards por seção (mesmas 7 do form)
- Botão "Editar" (se role permite)
- Botão "Anexos" → /app/cidadaos/[id]/anexos
- Botão "Histórico" → /app/cidadaos/[id]/historico

### Task 8: Anexos `/app/cidadaos/[id]/anexos`

- Upload area (drag-and-drop, multi-file)
- Lista de anexos com preview (PDF inline, IMG thumbnail)
- Botão download (gera presigned URL)
- Botão remover (soft delete)

### Task 9: Histórico `/app/cidadaos/[id]/historico`

- Timeline do audit log filtrado por `entity_id = cidadao_id`
- Mostra: data, autor, ação, campos mudados (do meta JSON)
- (Diff visual fica pra evolução futura — §0.8)

### Task 10: Testes e2e

- `tests/e2e/cidadao-crud.spec.ts`:
  - Criar cidadão (recepção)
  - Buscar por nome
  - Editar telefone (profissional)
  - Soft delete (gestor_unidade)
  - Tentar acesso unidade errada (gestor_unidade de capacitação → cidadão da médica) → 403

### Task 11: Atualizar memorias + README

---

## Self-Review Checklist

- ✅ Spec coverage: Ficha Cidadã + anexos (do Núcleo Transversal)
- ⚠️ **DECISÕES ABERTAS**: 10 perguntas em §0
- ⚠️ **Dependência**: Plano 2 RBAC/RLS precisa estar pronto antes
- ✅ Testes: unit (cpf) + e2e (CRUD + RBAC integration)
- ✅ LGPD baseline: soft delete + anonimização. Detalhes mais finos no Plano 5.
- ⚠️ **Buscar por CPF parcial** (digitar 3 dígitos e ver matches) precisa indexar CPF com trigram — confirmar com Erick se isso é ok ou se prefere busca exata só

---

## Estimativa

- Decisões §0: 1h de conversa com Erick (mais demoradas que Plano 2 — escolhas de UX)
- Tasks 1-3 (schema + helpers): 2h
- Task 4 (MinIO): 1.5h (precisa testar presigned URLs com IFP-Connect → MinIO interno no WSL)
- Tasks 5-7 (lista + form + detalhe): 4-5h (form tabbed é trabalhoso)
- Tasks 8-9 (anexos + histórico): 2h
- Task 10 (e2e): 1h
- Task 11 (docs): 30min
- **Total: ~12-14h após decisões resolvidas**
