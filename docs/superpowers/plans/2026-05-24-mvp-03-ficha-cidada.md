# IFP Connect MVP — Plano 3: Ficha Cidadã — Implementation Plan (DRAFT)

> **Status:** DRAFT — escrito sem input do Erick durante autopilot overnight 2026-05-24. Tarefas e estrutura prontas; **decisões abertas (seção 0) precisam ser resolvidas antes da execução**.
>
> **Depende de:** Plano 2 RBAC + RLS pronto (campos sensíveis + isolamento por unidade já existem).

**Goal:** Implementar o cadastro central da plataforma — a "Ficha Cidadã" — usado como ponto único de identificação de qualquer pessoa atendida pelo IFP, com integração de anexos (documentos, fotos), busca e histórico de mudanças.

**Architecture:** Modelo `Cidadao` com campos próprios + relação 1:N com `Endereco`, 1:N com `AnexoCidadao` (armazenamento no MinIO via presigned URL), 1:N com `Familiar` (dependentes). Mudanças registradas via audit log do Plano 2. Busca via Postgres trigram (`pg_trgm`) — full-text simples no MVP, semantic search no Plano A.3 (CLEANHUB).

**Plano base:** Plano 2 RBAC (✅ ou em andamento).

---

## 0. DECISÕES ABERTAS (resolver antes de executar)

### 0.1 Schema obrigatório vs opcional

Campos sugeridos. Marque ✅ se obrigatório, ⭕ se opcional, ❌ se NÃO incluir:

**Identificação**

- [ ] `nome_completo` (string) — proposta: ✅ obrigatório
- [ ] `nome_social` (string) — proposta: ⭕ opcional (LGBTQIA+, pessoas trans)
- [ ] `cpf` (string, único) — proposta: ⭕ opcional (alguns sem documento, ainda atendem)
- [ ] `rg` (string) — proposta: ⭕ opcional
- [ ] `data_nascimento` (date) — proposta: ✅
- [ ] `genero` (enum) — proposta: ⭕ (`feminino | masculino | nao_binario | nao_informar`)
- [ ] `orientacao_sexual` (enum) — proposta: ❌ (sensível, perguntar antes)
- [ ] `cor_raca` (enum IBGE: branca/preta/parda/amarela/indigena) — proposta: ⭕ (relatório de equidade)
- [ ] `estado_civil` (enum) — proposta: ⭕
- [ ] `nacionalidade` (string) — proposta: ⭕

**Contato**

- [ ] `telefone_principal` (string) — proposta: ✅
- [ ] `telefone_secundario` (string) — proposta: ⭕
- [ ] `email` (string) — proposta: ⭕
- [ ] `whatsapp_consente` (boolean) — proposta: ⭕

**Socioeconômico** (visível pra perfil `social` — Raquel)

- [ ] `renda_familiar` (decimal) — proposta: ⭕
- [ ] `pessoas_na_casa` (int) — proposta: ⭕
- [ ] `beneficio_social` (enum: `bolsa_familia | bpc | nenhum | outro`) — proposta: ⭕
- [ ] `escolaridade` (enum) — proposta: ⭕
- [ ] `trabalha` (boolean + descricao) — proposta: ⭕

**Saúde** (visível pra perfil `profissional` da unidade médica — Plano 4)

- [ ] `tipo_sanguineo` (enum) — proposta: ⭕
- [ ] `alergias` (text) — proposta: ⭕
- [ ] `medicamentos_em_uso` (text) — proposta: ⭕
- [ ] `condicoes_cronicas` (text) — proposta: ⭕

**Sistema**

- `created_by` (User) — automático
- `unit_id_origem` (Unit) — automático (qual unidade cadastrou primeiro)
- `created_at`, `updated_at` — automático
- `deleted_at` (soft delete) — automático

**❓ Pergunta:** revisar cada campo, marcar obrigatório/opcional/excluir. Adicionar campos que eu esqueci.

### 0.2 CPF — validação e unicidade

- Aceitar sem CPF (`null`)?
- Validar dígito verificador (algoritmo CPF) antes de salvar?
- Aceitar CPF duplicado? (caso: hospital cadastrou cidadão, IFP cadastra de novo — dois registros com mesmo CPF?)
- Máscara: aceitar `000.000.000-00` ou só dígitos? Normalizar pra dígitos no DB?

**❓ Pergunta sugerida:** CPF opcional, mas se preenchido = único + validar dígito + normalizar pra 11 dígitos. Atendimento sem CPF gera flag `cpf_pendente`. OK?

### 0.3 Endereço

- 1 endereço apenas ou múltiplos (residencial, trabalho, contato)?
- Schema separado (tabela `Endereco` 1:N) ou JSONB embutido na Ficha?
- Auto-completar CEP via ViaCEP/BrasilAPI?
- Geocoding (lat/long) — guardar?

**❓ Pergunta sugerida:** 1:N com tabela própria `Endereco(id, cidadao_id, tipo, cep, logradouro, numero, ...)`. Auto-completar CEP via BrasilAPI. Sem geocoding no MVP.

### 0.4 Familiares / Dependentes

- IFP atende família, não só indivíduo. Como representar?
- Opção A — Cada pessoa = 1 Cidadao próprio + relação `familiar_de(cidadaoA, cidadaoB, parentesco)`
- Opção B — Cidadão principal + tabela `Dependente(nome, parentesco, data_nasc, ...)` sem virar Cidadao próprio
- Opção C — Ambos: Familia (grupo) + Cidadao (membro)

**❓ Pergunta:** A, B ou C? Recomendado: C (Familia agrupa, Cidadao = membro, simplifica relatórios "famílias atendidas" vs "indivíduos").

### 0.5 Anexos

- Tipos permitidos: PDF, JPG, PNG, DOCX, XLSX?
- Tamanho max por arquivo: 5MB? 10MB?
- Tamanho max total por Cidadao: 50MB? 100MB?
- Onde guardar: MinIO bucket `ifp-cidadao-anexos`
- Naming: `{cidadao_id}/{anexo_id}_{slug_nome_original}.{ext}` ou hash?
- Antivírus scan? (ClamAV no upload?)
- Foto do cidadão = "anexo do tipo avatar" ou campo separado?

**❓ Pergunta sugerida:** Tipos PDF/JPG/PNG (sem Office docs - vetor de macro malware), max 10MB por arquivo, 100MB total. Naming com hash. SEM antivírus no MVP (próximo plano). Foto = campo `foto_url` separado da tabela de anexos.

### 0.6 Busca

- Quais campos pesquisar: nome, cpf, telefone? Endereço?
- Full-text Postgres (`tsvector`) ou trigram (`pg_trgm`)?
- Busca "fuzzy" (tolerância a erro): "Maria Silba" encontra "Maria Silva"?
- Filtros: por unidade, por status, por idade range, por data cadastro?

**❓ Pergunta sugerida:** Trigram em nome_completo + nome_social + CPF + telefone_principal. Fuzzy via similarity > 0.3. Filtros: unidade + status + range etário. Busca semantica fica pra Plano A.3 (refinement futuro).

### 0.7 UI do form de cadastro

- Form único longo (scroll) vs wizard multi-step vs tabbed
- Salvamento parcial (draft) ou só finalize?
- Validação inline (campo por campo) ou só no submit?
- Mobile-first? Tablet (recepção usa tablet)?

**❓ Pergunta sugerida:** Tabbed (Identificação / Contato / Endereço / Socioeconômico / Saúde / Anexos / Família) com salvamento parcial após Identificação preenchida. Validação inline. Mobile-first (recepção da capacitação usa tablet).

### 0.8 Histórico / versionamento

- Toda mudança vira entry no audit log (Plano 2) — OK
- MAS precisamos de "diff visual" (campo X mudou de Y pra Z)?
- Snapshot completo a cada save vs apenas diff?

**❓ Pergunta sugerida:** Audit log captura `entity=cidadao, action=update, meta={changedFields: ["telefone"], oldValue, newValue}`. UI mostra timeline simples no MVP, sem diff visual fancy. OK?

### 0.9 Soft delete e direito ao esquecimento (LGPD)

- Soft delete = `deleted_at IS NOT NULL`, registro permanece pra histórico
- LGPD "direito ao esquecimento" = hard delete + anonimização

**❓ Pergunta sugerida:** Soft delete por default. UI tem botão "Excluir definitivamente (LGPD)" só pra `super_admin`, que anonimiza (PII vira `[anonimizado]`) e mantém `id` + counters pra relatórios. Hard delete real = nunca (compliance). OK?

### 0.10 Importador de dados existentes

Spec menciona "importador genérico no MVP por causa das origens Amplimed + Google Sheets". Esse é o **Plano 6** (Importer), separado deste.

**❓ Pergunta:** confirma que importador NÃO está no Plano 3, fica no Plano 6?

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
